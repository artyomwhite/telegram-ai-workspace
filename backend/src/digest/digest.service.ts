import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DigestTelegramSender } from './digest-telegram.sender';
import {
  endOfZonedDayUtc,
  resolveDigestTimezone,
  startOfZonedDayUtc,
} from './digest-timezone.util';

type TaskDigestRow = { id: string; title: string; priority: TaskPriority };
type CompletedRow = { id: string; title: string };

export interface DigestContent {
  dueToday: TaskDigestRow[];
  overdue: TaskDigestRow[];
  completedYesterday: CompletedRow[];
  suggested: { id: string; title: string; priority: TaskPriority; reason: string }[];
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramSender: DigestTelegramSender,
    private readonly configService: ConfigService,
  ) {}

  getTimezone(): string {
    return resolveDigestTimezone(
      this.configService.get<string>('digest.timezone'),
    );
  }

  async buildDigest(userId: string): Promise<DigestContent> {
    const tz = this.getTimezone();
    const now = new Date();
    const startOfToday = startOfZonedDayUtc(tz, now);
    const endOfToday = endOfZonedDayUtc(tz, now);
    const startOfYesterday = startOfZonedDayUtc(tz, now, -1);

    const [dueToday, overdue, completedYesterday, highPriorityOpen] =
      await Promise.all([
        this.prisma.task.findMany({
          where: {
            userId,
            status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
            dueDate: { gte: startOfToday, lte: endOfToday },
          },
          select: { id: true, title: true, priority: true },
          orderBy: { priority: 'desc' },
        }),
        this.prisma.task.findMany({
          where: {
            userId,
            status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
            dueDate: { lt: startOfToday },
          },
          select: { id: true, title: true, priority: true },
          orderBy: { dueDate: 'asc' },
          take: 5,
        }),
        this.prisma.task.findMany({
          where: {
            userId,
            status: TaskStatus.COMPLETED,
            completedAt: { gte: startOfYesterday, lt: startOfToday },
          },
          select: { id: true, title: true },
          take: 5,
        }),
        this.prisma.task.findMany({
          where: {
            userId,
            status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
            priority: { in: [TaskPriority.HIGH, TaskPriority.URGENT] },
          },
          select: { id: true, title: true, priority: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const excludeFromSuggested = new Set<string>([
      ...dueToday.map((t) => t.id),
      ...overdue.map((t) => t.id),
      ...completedYesterday.map((t) => t.id),
    ]);

    const suggested = highPriorityOpen
      .filter((t) => !excludeFromSuggested.has(t.id))
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        reason: 'High priority — tackle today',
      }));

    return {
      dueToday: this.dedupeById(dueToday),
      overdue: this.dedupeById(overdue),
      completedYesterday: this.dedupeById(completedYesterday),
      suggested,
    };
  }

  formatDigestMessage(content: DigestContent): string {
    const lines = ['📊 <b>Daily Digest</b>', ''];

    lines.push('<b>📅 Due today</b>');
    if (content.dueToday.length) {
      content.dueToday.forEach((t) =>
        lines.push(`• ${t.title} [${t.priority}]`),
      );
    } else {
      lines.push('• None — clear schedule!');
    }

    lines.push('', '<b>⚠️ Overdue</b>');
    if (content.overdue.length) {
      content.overdue.forEach((t) =>
        lines.push(`• ${t.title} [${t.priority}]`),
      );
    } else {
      lines.push('• All caught up ✅');
    }

    lines.push('', '<b>✅ Completed yesterday</b>');
    if (content.completedYesterday.length) {
      content.completedYesterday.forEach((t) => lines.push(`• ${t.title}`));
    } else {
      lines.push('• No completions yesterday');
    }

    lines.push('', '<b>🔥 Suggested priorities</b>');
    if (content.suggested.length) {
      content.suggested.forEach((t) =>
        lines.push(`• ${t.title} — ${t.reason}`),
      );
    } else {
      lines.push('• Review /tasks for your backlog');
    }

    lines.push('', '<i>Reply with natural language or use /tasks</i>');
    return lines.join('\n');
  }

  async sendAllDigests(): Promise<number> {
    const userIds = await this.getActiveTelegramUserIds();
    let sent = 0;

    for (const userId of userIds) {
      try {
        const delivered = await this.processUserDigest(userId);
        if (delivered) sent++;
      } catch (err) {
        this.logger.error(
          `Daily Digest failed for userId=${userId}: ${String(err)}`,
        );
      }
    }

    this.logger.log(
      `Daily Digest batch: sent=${sent} eligible=${userIds.length}`,
    );
    return sent;
  }

  private async processUserDigest(userId: string): Promise<boolean> {
    const connection = await this.prisma.telegramConnection.findFirst({
      where: { userId, isActive: true },
      orderBy: { connectedAt: 'desc' },
    });

    if (!connection) {
      this.logger.debug(
        `Daily Digest skipped userId=${userId} (no active Telegram connection)`,
      );
      return false;
    }

    const claimed = await this.claimDigestSlot(userId);
    if (!claimed) {
      this.logger.debug(
        `Daily Digest skipped userId=${userId} (already sent today)`,
      );
      return false;
    }

    try {
      const content = await this.buildDigest(userId);
      const message = this.formatDigestMessage(content);
      const ok = await this.telegramSender.send(connection.chatId, message);

      if (!ok) {
        await this.releaseDigestSlot(userId);
        throw new Error(`Telegram delivery failed for userId=${userId}`);
      }

      this.logger.log(
        `Daily Digest delivered userId=${userId} chatId=${connection.chatId}`,
      );
      return true;
    } catch (err) {
      await this.releaseDigestSlot(userId);
      throw err;
    }
  }

  private async getActiveTelegramUserIds(): Promise<string[]> {
    const connections = await this.prisma.telegramConnection.findMany({
      where: { isActive: true },
      select: { userId: true },
      distinct: ['userId'],
    });
    return connections.map((c) => c.userId);
  }

  /** Reserve today's digest slot before sending to prevent duplicate delivery */
  private async claimDigestSlot(userId: string): Promise<boolean> {
    const startOfToday = startOfZonedDayUtc(this.getTimezone());

    const existing = await this.prisma.activityLog.findFirst({
      where: {
        userId,
        entityType: 'Digest',
        createdAt: { gte: startOfToday },
      },
    });

    if (existing) return false;

    await this.prisma.activityLog.create({
      data: {
        userId,
        type: 'OTHER',
        entityType: 'Digest',
        description: 'Daily digest sent via Telegram',
      },
    });

    return true;
  }

  private async releaseDigestSlot(userId: string): Promise<void> {
    const startOfToday = startOfZonedDayUtc(this.getTimezone());
    await this.prisma.activityLog.deleteMany({
      where: {
        userId,
        entityType: 'Digest',
        createdAt: { gte: startOfToday },
      },
    });
  }

  private dedupeById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }
}
