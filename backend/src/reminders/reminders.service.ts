import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, ReminderStatus } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto, UpdateReminderDto } from './dto/reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async create(userId: string, dto: CreateReminderDto) {
    const reminder = await this.prisma.reminder.create({
      data: { ...dto, userId },
      include: { task: true },
    });
    await this.activityService.log(
      userId,
      ActivityType.CREATED,
      'Reminder',
      `Created reminder "${reminder.title}"`,
      reminder.id,
    );
    return reminder;
  }

  async findAll(
    userId: string,
    page: number,
    limit: number,
    status?: ReminderStatus,
  ) {
    const skip = (page - 1) * limit;
    const where = { userId, ...(status ? { status } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        include: { task: true },
        orderBy: { remindAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.reminder.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(userId: string, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
      include: { task: true },
    });
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }

  async update(userId: string, id: string, dto: UpdateReminderDto) {
    await this.findOne(userId, id);
    const reminder = await this.prisma.reminder.update({
      where: { id },
      data: dto,
      include: { task: true },
    });
    await this.activityService.log(
      userId,
      ActivityType.UPDATED,
      'Reminder',
      `Updated reminder "${reminder.title}"`,
      id,
    );
    return reminder;
  }

  async remove(userId: string, id: string) {
    const reminder = await this.findOne(userId, id);
    await this.prisma.reminder.delete({ where: { id } });
    await this.activityService.log(
      userId,
      ActivityType.DELETED,
      'Reminder',
      `Deleted reminder "${reminder.title}"`,
      id,
    );
    return { success: true };
  }

  async processDueReminders() {
    const due = await this.prisma.reminder.findMany({
      where: {
        status: ReminderStatus.PENDING,
        remindAt: { lte: new Date() },
      },
      include: { user: { include: { telegramConnections: true } } },
    });

    for (const reminder of due) {
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: ReminderStatus.SENT, sentAt: new Date() },
      });
    }

    return due;
  }
}
