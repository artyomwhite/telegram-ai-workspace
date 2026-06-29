import { TaskPriority, TaskStatus } from '@prisma/client';

export enum AiTaskIntent {
  CREATE_TASK = 'CREATE_TASK',
  COMPLETE_TASK = 'COMPLETE_TASK',
  DELETE_TASK = 'DELETE_TASK',
  UPDATE_TASK = 'UPDATE_TASK',
  LIST_TASKS = 'LIST_TASKS',
  UNKNOWN = 'UNKNOWN',
}

export interface ParsedTaskInput {
  title: string;
  datetime?: Date;
  priority?: TaskPriority;
  status?: TaskStatus;
  type: 'TASK';
  confidence: number;
  intent: AiTaskIntent;
  taskRef?: string;
  updates?: Partial<{
    title: string;
    priority: TaskPriority;
    status: TaskStatus;
    description: string;
  }>;
}

export interface AiTaskParseResult extends ParsedTaskInput {
  rawInput: string;
}
