import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType, TaskPriority, TaskStatus } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AiTaskIntent, AiTaskParseResult } from '../ai-task/ai-task.intent';
import { AiTaskService } from '../ai-task/ai-task.service';
import { CompaniesService } from '../companies/companies.service';
import { ContactsService } from '../contacts/contacts.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from '../reminders/reminders.service';
import { TasksService } from '../tasks/tasks.service';

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

type InlineKeyboard = InlineKeyboardButton[][];

interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
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

  async sendMessage(
    chatId: string | number,
    text: string,
    keyboard?: InlineKeyboard,
  ) {
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
        ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Telegram API error: ${error}`);
    }
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    keyboard?: InlineKeyboard,
  ) {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) return;

    const response = await fetch(`${this.baseUrl}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Telegram editMessageText error: ${error}`);
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) return;

    await fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(text ? { text, show_alert: false } : {}),
      }),
    });
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
    private readonly aiTaskService: AiTaskService,
  ) {}

  async handleUpdate(update: TelegramUpdate) {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

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
            await this.handleTasks(
              chatId,
              user,
              this.parseTasksPage(args[0]),
              this.parseTasksLimit(args[1]),
            );
            break;
          case '/deletetask':
            await this.handleDeleteTask(chatId, user, argText);
            break;
          case '/completetask':
            await this.handleCompleteTask(chatId, user, argText);
            break;
          case '/updatetask':
            await this.handleUpdateTask(chatId, user, args);
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
            await this.handleAiInput(chatId, user, text);
        }
      }
    }
  }

  private async resolveTelegramUser(
    telegramUserId: string,
    chatId: string,
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null> {
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
    this.logger.log(
      `TelegramUser → DashboardUser mapping: ${user.email} (userId=${user.id})`,
    );
    return user;
  }

  private parseTasksPage(value?: string): number {
    const page = parseInt(value ?? '', 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
  }

  private parseTasksLimit(value?: string): number {
    const limit = parseInt(value ?? '', 10);
    if (!Number.isFinite(limit) || limit < 1) return 5;
    return Math.min(5, limit);
  }

  private priorityEmoji(priority: TaskPriority): string {
    if (priority === TaskPriority.HIGH || priority === TaskPriority.URGENT) {
      return ' 🔥';
    }
    return '';
  }

  private formatTaskLine(
    index: number,
    title: string,
    status: TaskStatus,
    priority: TaskPriority,
  ): string {
    return `${index}. ${title} [${status}] [${priority}]${this.priorityEmoji(priority)}`;
  }

  private buildTaskKeyboard(
    tasks: { id: string; title: string }[],
    page: number,
    limit: number,
    totalPages: number,
  ): InlineKeyboard {
    const keyboard: InlineKeyboard = tasks.map((task) => [
      { text: '✔ Complete', callback_data: `t:c:${task.id}:${page}:${limit}` },
      { text: '✏ Update', callback_data: `t:u:${task.id}` },
      { text: '🗑 Delete', callback_data: `t:d:${task.id}:${page}:${limit}` },
    ]);

    if (totalPages > 1) {
      const nav: InlineKeyboardButton[] = [];
      if (page > 1) {
        nav.push({
          text: '⬅ Previous',
          callback_data: `t:prev:${page}:${limit}`,
        });
      }
      if (page < totalPages) {
        nav.push({ text: 'Next ➡', callback_data: `t:next:${page}:${limit}` });
      }
      if (nav.length) keyboard.push(nav);
    }

    return keyboard;
  }

  private async renderTasksPage(
    chatId: string,
    user: { id: string; email: string },
    page: number,
    limit: number,
    messageId?: number,
  ): Promise<void> {
    const { data, total } = await this.tasksService.findAll(
      user.id,
      page,
      limit,
    );
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    if (safePage !== page) {
      return this.renderTasksPage(chatId, user, safePage, limit, messageId);
    }

    if (data.length === 0) {
      const text = `<b>You don't have any tasks yet.</b>\n\nTry:\n\n/newtask Call client tomorrow 5pm`;
      if (messageId) {
        await this.telegramApi.editMessageText(chatId, messageId, text);
      } else {
        await this.telegramApi.sendMessage(chatId, text);
      }
      return;
    }

    const lines = data.map((t, i) =>
      this.formatTaskLine(
        (page - 1) * limit + i + 1,
        t.title,
        t.status,
        t.priority,
      ),
    );
    const text = `<b>Page ${page}/${totalPages}</b>\n\n${lines.join('\n')}${this.buildTasksListFooter(page, totalPages)}`;
    const keyboard = this.buildTaskKeyboard(data, page, limit, totalPages);

    if (messageId) {
      await this.telegramApi.editMessageText(chatId, messageId, text, keyboard);
    } else {
      await this.telegramApi.sendMessage(chatId, text, keyboard);
    }
  }

  private buildTasksListFooter(page: number, totalPages: number): string {
    const lines = [
      '',
      '────────────',
      '',
      'Use the buttons below:',
      '',
      '✔ Complete',
      '✏ Update',
      '🗑 Delete',
    ];
    if (page < totalPages) {
      lines.push('', 'Next page:', `/tasks ${page + 1}`);
    }
    return lines.join('\n');
  }

  private async handleCallbackQuery(
    query: NonNullable<TelegramUpdate['callback_query']>,
  ) {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const telegramUserId = String(query.from.id);
    const data = query.data ?? '';

    if (!chatId) {
      await this.telegramApi.answerCallbackQuery(query.id);
      return;
    }

    const user = await this.resolveTelegramUser(telegramUserId, String(chatId));
    if (!user) {
      await this.telegramApi.answerCallbackQuery(
        query.id,
        'Connect your account with /connect <email>',
      );
      return;
    }

    const [prefix, action, ...rest] = data.split(':');

    try {
      if (prefix === 't' && action === 'c' && rest[0]) {
        const page = this.parseTasksPage(rest[1]);
        const limit = this.parseTasksLimit(rest[2]);
        await this.tasksService.update(user.id, rest[0], {
          status: TaskStatus.COMPLETED,
        });
        await this.telegramApi.answerCallbackQuery(query.id, 'Task completed');
        if (messageId) {
          await this.renderTasksPage(
            String(chatId),
            user,
            page,
            limit,
            messageId,
          );
        }
        return;
      }

      if (prefix === 't' && action === 'd' && rest[0]) {
        const page = this.parseTasksPage(rest[1]);
        const limit = this.parseTasksLimit(rest[2]);
        await this.tasksService.remove(user.id, rest[0]);
        await this.telegramApi.answerCallbackQuery(query.id, 'Task deleted');
        if (messageId) {
          await this.renderTasksPage(
            String(chatId),
            user,
            page,
            limit,
            messageId,
          );
        }
        return;
      }

      if (prefix === 't' && action === 'u' && rest[0]) {
        await this.telegramApi.answerCallbackQuery(query.id);
        await this.telegramApi.sendMessage(
          String(chatId),
          `✏ Update task <code>${rest[0]}</code>:\n/updatetask ${rest[0]} priority=HIGH\n/updatetask ${rest[0]} status=IN_PROGRESS\n/updatetask ${rest[0]} title=New title`,
        );
        return;
      }

      if (
        prefix === 't' &&
        (action === 'prev' || action === 'next') &&
        rest[0]
      ) {
        const currentPage = parseInt(rest[0], 10);
        const limit = this.parseTasksLimit(rest[1]);
        const page =
          action === 'prev' ? Math.max(1, currentPage - 1) : currentPage + 1;
        await this.telegramApi.answerCallbackQuery(query.id);
        if (messageId) {
          await this.renderTasksPage(
            String(chatId),
            user,
            page,
            limit,
            messageId,
          );
        }
        return;
      }
    } catch (err) {
      this.logger.error(`Callback action failed: ${String(err)}`);
      await this.telegramApi.answerCallbackQuery(query.id, 'Action failed');
      return;
    }

    await this.telegramApi.answerCallbackQuery(query.id);
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
    const help = `<b>📋 Task Management</b>

/newtask &lt;text&gt;
Create task (dates &amp; priority detected automatically)

/tasks [page]
Browse your tasks

/completetask &lt;id|#&gt;

/updatetask &lt;id&gt; field=value

/deletetask &lt;id|#&gt;

<b>🤖 AI Quick Capture</b>

Just send a message like:

<i>Call client tomorrow at 5pm high priority</i>

No command required.

<b>👥 CRM</b>

/contact &lt;name&gt;

/company &lt;name&gt;

/search &lt;query&gt;

<b>⏰ Productivity</b>

/remind &lt;title&gt; | &lt;datetime&gt;

/stats

<b>⚙ Account</b>

/connect &lt;email&gt;

/start

/help`;

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

    this.logger.log(
      `TelegramUser → DashboardUser mapping: ${user.email} (userId=${user.id})`,
    );

    await this.telegramApi.sendMessage(
      chatId,
      `✅ Connected to <b>${user.firstName} ${user.lastName}</b> (${user.email})`,
    );
  }

  private async createTaskFromParsed(
    chatId: string,
    user: { id: string; email: string },
    parsed: AiTaskParseResult,
    rawInput: string,
  ) {
    this.logger.log(
      `TelegramUser → DashboardUser mapping: ${user.email} (userId=${user.id})`,
    );
    const payload = this.aiTaskService.toCreatePayload(parsed);
    await this.tasksService.create(user.id, payload);

    await this.telegramApi.sendMessage(
      chatId,
      this.formatTaskCreatedMessage(parsed, user, payload),
    );
    void this.aiTaskService.logAiRequest(
      user.id,
      rawInput,
      JSON.stringify(parsed),
    );
  }

  private formatTaskCreatedMessage(
    parsed: AiTaskParseResult,
    user: { email: string },
    payload: { title: string; priority: TaskPriority; dueDate?: Date },
  ): string {
    const priorityEmoji =
      payload.priority === TaskPriority.HIGH ||
      payload.priority === TaskPriority.URGENT
        ? ' 🔥'
        : '';
    const dueLine = payload.dueDate
      ? payload.dueDate.toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Not set';

    return [
      '✅ <b>Task created successfully</b>',
      '',
      '<b>Title:</b>',
      parsed.title,
      '',
      '<b>Priority:</b>',
      `${payload.priority}${priorityEmoji}`,
      '',
      '<b>Due:</b>',
      dueLine,
      '',
      '<b>Account:</b>',
      user.email,
    ].join('\n');
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

    const parsed = this.aiTaskService.parse(title);
    await this.createTaskFromParsed(chatId, user, parsed, title);
  }

  private async handleAiInput(
    chatId: string,
    user: { id: string; email: string },
    text: string,
  ) {
    const parsed = this.aiTaskService.parse(text);

    if (
      parsed.intent === AiTaskIntent.UNKNOWN ||
      (parsed.confidence < 0.55 && parsed.intent === AiTaskIntent.CREATE_TASK)
    ) {
      await this.telegramApi.sendMessage(
        chatId,
        'Unknown command. Type /help or send a task in natural language.\n\nExample: <i>Call client tomorrow at 5pm high priority</i>',
      );
      return;
    }

    void this.aiTaskService.logAiRequest(user.id, text, JSON.stringify(parsed));

    switch (parsed.intent) {
      case AiTaskIntent.CREATE_TASK:
        await this.createTaskFromParsed(chatId, user, parsed, text);
        break;
      case AiTaskIntent.LIST_TASKS:
        await this.handleTasks(chatId, user, 1, 5);
        break;
      case AiTaskIntent.COMPLETE_TASK:
        if (parsed.taskRef) {
          await this.handleCompleteTask(chatId, user, parsed.taskRef);
        } else {
          await this.telegramApi.sendMessage(
            chatId,
            'Which task? Try: <i>complete task 1</i> or /completetask 1',
          );
        }
        break;
      case AiTaskIntent.DELETE_TASK:
        if (parsed.taskRef) {
          await this.handleDeleteTask(chatId, user, parsed.taskRef);
        } else {
          await this.telegramApi.sendMessage(
            chatId,
            'Which task? Try: <i>delete task 2</i> or /deletetask 2',
          );
        }
        break;
      case AiTaskIntent.UPDATE_TASK:
        if (parsed.taskRef && parsed.updates) {
          await this.handleUpdateTask(chatId, user, [
            parsed.taskRef,
            ...Object.entries(parsed.updates).map(([k, v]) => `${k}=${v}`),
          ]);
        } else {
          await this.telegramApi.sendMessage(
            chatId,
            'Try: <i>update task 1 priority=HIGH</i> or /updatetask 1 priority=HIGH',
          );
        }
        break;
      default:
        await this.telegramApi.sendMessage(
          chatId,
          'Unknown command. Type /help for available commands.',
        );
    }
  }

  private async handleTasks(
    chatId: string,
    user: { id: string; email: string },
    page: number,
    limit: number,
  ) {
    await this.renderTasksPage(chatId, user, page, limit);
  }

  private async handleDeleteTask(
    chatId: string,
    user: { id: string; email: string },
    idOrNumber: string,
  ) {
    if (!idOrNumber) {
      await this.telegramApi.sendMessage(
        chatId,
        'Usage: /deletetask &lt;id|#&gt;',
      );
      return;
    }

    const task = await this.tasksService.resolveByIdOrIndex(
      user.id,
      idOrNumber,
    );
    if (!task) {
      await this.telegramApi.sendMessage(chatId, 'Task not found.');
      return;
    }

    await this.tasksService.remove(user.id, task.id);
    await this.telegramApi.sendMessage(
      chatId,
      `🗑 Deleted: <b>${task.title}</b>`,
    );
  }

  private async handleCompleteTask(
    chatId: string,
    user: { id: string; email: string },
    idOrNumber: string,
  ) {
    if (!idOrNumber) {
      await this.telegramApi.sendMessage(
        chatId,
        'Usage: /completetask &lt;id|#&gt;',
      );
      return;
    }

    const task = await this.tasksService.resolveByIdOrIndex(
      user.id,
      idOrNumber,
    );
    if (!task) {
      await this.telegramApi.sendMessage(chatId, 'Task not found.');
      return;
    }

    await this.tasksService.update(user.id, task.id, {
      status: TaskStatus.COMPLETED,
    });
    await this.telegramApi.sendMessage(
      chatId,
      `✅ Completed: <b>${task.title}</b>`,
    );
  }

  private async handleUpdateTask(
    chatId: string,
    user: { id: string; email: string },
    args: string[],
  ) {
    const [idOrNumber, ...fieldParts] = args;
    if (!idOrNumber || fieldParts.length === 0) {
      await this.telegramApi.sendMessage(
        chatId,
        'Usage: /updatetask &lt;id&gt; priority=HIGH',
      );
      return;
    }

    const task = await this.tasksService.resolveByIdOrIndex(
      user.id,
      idOrNumber,
    );
    if (!task) {
      await this.telegramApi.sendMessage(chatId, 'Task not found.');
      return;
    }

    const updates: Record<string, string> = {};
    for (const part of fieldParts.join(' ').split(/\s+/)) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      updates[part.slice(0, eq).toLowerCase()] = part.slice(eq + 1);
    }

    const dto: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
    } = {};

    if (updates.title) dto.title = updates.title;
    if (updates.description) dto.description = updates.description;
    if (
      updates.status &&
      Object.values(TaskStatus).includes(updates.status as TaskStatus)
    ) {
      dto.status = updates.status as TaskStatus;
    }
    if (
      updates.priority &&
      Object.values(TaskPriority).includes(updates.priority as TaskPriority)
    ) {
      dto.priority = updates.priority as TaskPriority;
    }

    if (!Object.keys(dto).length) {
      await this.telegramApi.sendMessage(
        chatId,
        'Supported fields: title, description, status, priority',
      );
      return;
    }

    const updated = await this.tasksService.update(user.id, task.id, dto);
    await this.telegramApi.sendMessage(
      chatId,
      `✏ Updated: <b>${updated?.title ?? task.title}</b>`,
    );
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
