import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType, TaskPriority, TaskStatus } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { CompaniesService } from '../companies/companies.service';
import { ContactsService } from '../contacts/contacts.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from '../reminders/reminders.service';
import { TasksService } from '../tasks/tasks.service';

interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}

export function resolveWebhookTargetUrl(webhookUrl: string): string {
  const normalized = webhookUrl.replace(/\/$/, '');
  if (normalized.endsWith('/telegram/webhook')) {
    return normalized;
  }
  return `${normalized}/telegram/webhook`;
}

@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('telegram.botToken');
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: string | number, text: string) {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured');
      return;
    }

    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Telegram API error: ${error}`);
    }
  }

  async setWebhook(url: string): Promise<Record<string, unknown>> {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured');
      return { ok: false, description: 'No bot token' };
    }

    const response = await fetch(`${this.baseUrl}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const result = (await response.json()) as Record<string, unknown>;

    if (!response.ok || result.ok === false) {
      this.logger.error(
        `setWebhook failed for ${url}: ${JSON.stringify(result)}`,
      );
    } else {
      this.logger.log(`setWebhook succeeded for ${url}`);
    }

    return result;
  }

  async registerWebhookFromEnv(): Promise<Record<string, unknown>> {
    const webhookUrl = this.configService.get<string>('telegram.webhookUrl');
    if (!webhookUrl) {
      this.logger.warn('WEBHOOK_URL not configured');
      return { ok: false, description: 'WEBHOOK_URL not configured' };
    }

    const targetUrl = resolveWebhookTargetUrl(webhookUrl);
    return this.setWebhook(targetUrl);
  }

  async deleteWebhook(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/deleteWebhook`, {
      method: 'POST',
    });
    return response.json() as Promise<Record<string, unknown>>;
  }

  async getWebhookInfo(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/getWebhookInfo`);
    return response.json() as Promise<Record<string, unknown>>;
  }
}

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramApi: TelegramApiService,
    private readonly activityService: ActivityService,
    private readonly tasksService: TasksService,
    private readonly contactsService: ContactsService,
    private readonly companiesService: CompaniesService,
    private readonly remindersService: RemindersService,
  ) {}

  async handleUpdate(update: TelegramUpdate) {
    const message = update.message;
    if (!message?.text || !message.from) return;

    const chatId = String(message.chat.id);
    const telegramUserId = String(message.from.id);
    const text = message.text.trim();
    const [command, ...args] = text.split(' ');
    const argText = args.join(' ').trim();

    await this.logMessage(
      telegramUserId,
      'inbound',
      text,
      String(message.message_id),
    );

    const cmd = command.toLowerCase().split('@')[0];

    switch (cmd) {
      case '/start':
        await this.handleStart(chatId, telegramUserId, message.from.username);
        break;
      case '/help':
        await this.handleHelp(chatId);
        break;
      case '/connect':
        await this.handleConnect(
          chatId,
          telegramUserId,
          message.from.username,
          argText,
        );
        break;
      default: {
        const user = await this.resolveTelegramUser(telegramUserId, chatId);
        if (!user) {
          await this.telegramApi.sendMessage(
            chatId,
            'Please connect your account first with /connect <email>',
          );
          return;
        }

        switch (cmd) {
          case '/newtask':
            await this.handleNewTask(chatId, user, argText);
            break;
          case '/tasks':
            await this.handleTasks(chatId, user.id);
            break;
          case '/remind':
            await this.handleRemind(chatId, user.id, argText);
            break;
          case '/contact':
            await this.handleContact(chatId, user.id, argText);
            break;
          case '/company':
            await this.handleCompany(chatId, user.id, argText);
            break;
          case '/search':
            await this.handleSearch(chatId, user.id, argText);
            break;
          case '/stats':
            await this.handleStats(chatId, user.id);
            break;
          default:
            await this.telegramApi.sendMessage(
              chatId,
              'Unknown command. Type /help for available commands.',
            );
        }
      }
    }
  }

  private async resolveTelegramUser(
    telegramUserId: string,
    chatId: string,
  ): Promise<{ id: string; email: string; firstName: string; lastName: string } | null> {
    let connection = await this.prisma.telegramConnection.findFirst({
      where: {
        isActive: true,
        OR: [{ telegramUserId }, { chatId }],
      },
      include: { user: true },
    });

    if (!connection) {
      return null;
    }

    if (connection.telegramUserId !== telegramUserId) {
      connection = await this.prisma.telegramConnection.update({
        where: { id: connection.id },
        data: { telegramUserId, chatId },
        include: { user: true },
      });
    } else if (connection.chatId !== chatId) {
      connection = await this.prisma.telegramConnection.update({
        where: { id: connection.id },
        data: { chatId },
        include: { user: true },
      });
    }

    const user = connection.user;
    this.logger.log(`Telegram user: ${user.id} (${user.email})`);
    return user;
  }

  private async handleStart(
    chatId: string,
    telegramUserId: string,
    username?: string,
  ) {
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { telegramUserId },
    });

    const greeting = connection
      ? `Welcome back! Your account is connected.\n\nType /help to see available commands.`
      : `Welcome to <b>AI Business Assistant</b>!\n\nConnect your dashboard account:\n/connect your@email.com\n\nType /help for all commands.`;

    await this.telegramApi.sendMessage(chatId, greeting);
    if (username) {
      this.logger.log(`User @${username} (${telegramUserId}) started bot`);
    }
  }

  private async handleHelp(chatId: string) {
    const help = `<b>Available Commands</b>

/start - Welcome message
/connect &lt;email&gt; - Link your account
/help - Show this help
/newtask &lt;title&gt; - Create a new task
/tasks - List your open tasks
/remind &lt;title&gt; | &lt;datetime&gt; - Set a reminder
/contact &lt;name&gt; - Quick add contact
/company &lt;name&gt; - Quick add company
/search &lt;query&gt; - Search contacts, companies, tasks
/stats - View your business statistics`;

    await this.telegramApi.sendMessage(chatId, help);
  }

  private async handleConnect(
    chatId: string,
    telegramUserId: string,
    username: string | undefined,
    email: string,
  ) {
    if (!email) {
      await this.telegramApi.sendMessage(
        chatId,
        'Usage: /connect your@email.com',
      );
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      await this.telegramApi.sendMessage(
        chatId,
        `No account found for <b>${email}</b>.\nRegister at the dashboard first.`,
      );
      return;
    }

    const existing = await this.prisma.telegramConnection.findUnique({
      where: { telegramUserId },
    });

    if (existing && existing.userId !== user.id) {
      await this.prisma.telegramConnection.update({
        where: { telegramUserId },
        data: {
          userId: user.id,
          chatId,
          telegramUsername: username,
          isActive: true,
        },
      });
    } else if (!existing) {
      await this.prisma.telegramConnection.create({
        data: {
          userId: user.id,
          telegramUserId,
          telegramUsername: username,
          chatId,
        },
      });
    } else {
      await this.prisma.telegramConnection.update({
        where: { telegramUserId },
        data: { isActive: true, chatId, telegramUsername: username },
      });
    }

    await this.activityService.log(
      user.id,
      ActivityType.CONNECTED,
      'Telegram',
      `Telegram account connected (@${username ?? telegramUserId})`,
    );

    this.logger.log(`Telegram user: ${user.id} (${user.email})`);

    await this.telegramApi.sendMessage(
      chatId,
      `✅ Connected to <b>${user.firstName} ${user.lastName}</b> (${user.email})`,
    );
  }

  private async handleNewTask(
    chatId: string,
    user: { id: string; email: string },
    title: string,
  ) {
    if (!title) {
      await this.telegramApi.sendMessage(
        chatId,
        'Usage: /newtask Buy office supplies',
      );
      return;
    }

    this.logger.log(`Telegram user: ${user.id}`);
    const task = await this.tasksService.create(user.id, {
      title,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
    });

    await this.telegramApi.sendMessage(
      chatId,
      `✅ Task created: <b>${task.title}</b>\nID: ${task.id}\nAccount: ${user.email}`,
    );
  }

  private async handleTasks(chatId: string, userId: string) {
    const { data } = await this.tasksService.findAll(userId, 1, 10, undefined, {
      status: TaskStatus.TODO,
    });

    if (data.length === 0) {
      await this.telegramApi.sendMessage(
        chatId,
        'No open tasks. Use /newtask to create one.',
      );
      return;
    }

    const list = data
      .map((t, i) => `${i + 1}. <b>${t.title}</b> [${t.priority}]`)
      .join('\n');

    await this.telegramApi.sendMessage(chatId, `<b>Open Tasks</b>\n\n${list}`);
  }

  private async handleRemind(chatId: string, userId: string, input: string) {
    const parts = input.split('|').map((p) => p.trim());
    if (parts.length < 2) {
      await this.telegramApi.sendMessage(
        chatId,
        'Usage: /remind Meeting prep | 2026-07-01T10:00:00',
      );
      return;
    }

    const [title, dateStr] = parts;
    const remindAt = new Date(dateStr);
    if (isNaN(remindAt.getTime())) {
      await this.telegramApi.sendMessage(
        chatId,
        'Invalid date format. Use ISO format: 2026-07-01T10:00:00',
      );
      return;
    }

    const reminder = await this.remindersService.create(userId, {
      title,
      remindAt,
      message: `Reminder: ${title}`,
    });

    await this.telegramApi.sendMessage(
      chatId,
      `⏰ Reminder set: <b>${reminder.title}</b>\nAt: ${remindAt.toISOString()}`,
    );
  }

  private async handleContact(chatId: string, userId: string, name: string) {
    if (!name) {
      await this.telegramApi.sendMessage(chatId, 'Usage: /contact John Smith');
      return;
    }

    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '-';

    const contact = await this.contactsService.create(userId, {
      firstName,
      lastName,
    });

    await this.telegramApi.sendMessage(
      chatId,
      `👤 Contact added: <b>${contact.firstName} ${contact.lastName}</b>`,
    );
  }

  private async handleCompany(chatId: string, userId: string, name: string) {
    if (!name) {
      await this.telegramApi.sendMessage(chatId, 'Usage: /company Acme Corp');
      return;
    }

    const company = await this.companiesService.create(userId, { name });
    await this.telegramApi.sendMessage(
      chatId,
      `🏢 Company added: <b>${company.name}</b>`,
    );
  }

  private async handleSearch(chatId: string, userId: string, query: string) {
    if (!query) {
      await this.telegramApi.sendMessage(chatId, 'Usage: /search keyword');
      return;
    }

    const [contacts, companies, tasks] = await Promise.all([
      this.contactsService.findAll(userId, 1, 5, query),
      this.companiesService.findAll(userId, 1, 5, query),
      this.tasksService.findAll(userId, 1, 5, query),
    ]);

    const lines: string[] = [`<b>Search results for "${query}"</b>\n`];

    if (contacts.data.length) {
      lines.push('<b>Contacts:</b>');
      contacts.data.forEach((c) =>
        lines.push(`• ${c.firstName} ${c.lastName}`),
      );
    }
    if (companies.data.length) {
      lines.push('\n<b>Companies:</b>');
      companies.data.forEach((c) => lines.push(`• ${c.name}`));
    }
    if (tasks.data.length) {
      lines.push('\n<b>Tasks:</b>');
      tasks.data.forEach((t) => lines.push(`• ${t.title} [${t.status}]`));
    }

    if (
      contacts.data.length + companies.data.length + tasks.data.length ===
      0
    ) {
      lines.push('No results found.');
    }

    await this.telegramApi.sendMessage(chatId, lines.join('\n'));
  }

  private async handleStats(chatId: string, userId: string) {
    const [contacts, companies, tasks, openTasks, completedTasks, reminders] =
      await Promise.all([
        this.prisma.contact.count({ where: { userId } }),
        this.prisma.company.count({ where: { userId } }),
        this.prisma.task.count({ where: { userId } }),
        this.prisma.task.count({ where: { userId, status: TaskStatus.TODO } }),
        this.prisma.task.count({
          where: { userId, status: TaskStatus.COMPLETED },
        }),
        this.prisma.reminder.count({
          where: { userId, status: 'PENDING' },
        }),
      ]);

    const stats = `<b>Your Statistics</b>

👤 Contacts: ${contacts}
🏢 Companies: ${companies}
📋 Total Tasks: ${tasks}
📝 Open Tasks: ${openTasks}
✅ Completed: ${completedTasks}
⏰ Pending Reminders: ${reminders}`;

    await this.telegramApi.sendMessage(chatId, stats);
  }

  private async logMessage(
    telegramUserId: string,
    direction: string,
    content: string,
    telegramMessageId?: string,
  ) {
    const connection = await this.prisma.telegramConnection.findFirst({
      where: { telegramUserId, isActive: true },
    });
    if (!connection) return;

    await this.prisma.message.create({
      data: {
        userId: connection.userId,
        telegramUserId,
        direction,
        content,
        telegramMessageId,
      },
    });
  }
}

@Injectable()
export class TelegramConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getConnection(userId: string) {
    return this.prisma.telegramConnection.findFirst({
      where: { userId, isActive: true },
    });
  }

  async disconnect(userId: string) {
    const connection = await this.prisma.telegramConnection.findFirst({
      where: { userId },
    });
    if (!connection) return null;

    return this.prisma.telegramConnection.update({
      where: { id: connection.id },
      data: { isActive: false },
    });
  }
}
