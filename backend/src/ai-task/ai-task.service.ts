import { Injectable, Logger } from '@nestjs/common';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiTaskIntent, AiTaskParseResult } from './ai-task.intent';
import { parseTaskInput } from './ai-task.parser';

@Injectable()
export class AiTaskService {
  private readonly logger = new Logger(AiTaskService.name);

  constructor(private readonly prisma: PrismaService) {}

  parse(input: string): AiTaskParseResult {
    const result = parseTaskInput(input);
    this.logger.log(
      `AI parse: intent=${result.intent} confidence=${result.confidence.toFixed(2)} title="${result.title}"`,
    );
    return result;
  }

  toCreatePayload(parsed: AiTaskParseResult) {
    return {
      title: parsed.title,
      priority: parsed.priority ?? TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: parsed.datetime,
    };
  }

  shouldFallbackToAi(text: string, isCommand: boolean): boolean {
    if (!text.trim()) return false;
    if (!isCommand) return true;
    return !text.startsWith('/connect') && !text.startsWith('/start');
  }

  async logAiRequest(userId: string, prompt: string, response: string) {
    try {
      await this.prisma.aIRequest.create({
        data: {
          userId,
          prompt,
          response,
          model: 'rule-based-v1',
          status: 'COMPLETED',
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to log AI request: ${String(err)}`);
    }
  }

  formatCreateConfirmation(parsed: AiTaskParseResult): string {
    const parts = [`✅ <b>Task created:</b> ${parsed.title}`];
    if (parsed.priority && parsed.priority !== TaskPriority.MEDIUM) {
      parts.push(`Priority: ${parsed.priority}${parsed.priority === TaskPriority.HIGH || parsed.priority === TaskPriority.URGENT ? ' 🔥' : ''}`);
    }
    if (parsed.datetime) {
      parts.push(`Due: ${parsed.datetime.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`);
    }
    parts.push(`<i>AI confidence: ${Math.round(parsed.confidence * 100)}%</i>`);
    return parts.join('\n');
  }

  getIntentLabel(intent: AiTaskIntent): string {
    const labels: Record<AiTaskIntent, string> = {
      [AiTaskIntent.CREATE_TASK]: 'Create task',
      [AiTaskIntent.COMPLETE_TASK]: 'Complete task',
      [AiTaskIntent.DELETE_TASK]: 'Delete task',
      [AiTaskIntent.UPDATE_TASK]: 'Update task',
      [AiTaskIntent.LIST_TASKS]: 'List tasks',
      [AiTaskIntent.UNKNOWN]: 'Unknown',
    };
    return labels[intent];
  }
}
