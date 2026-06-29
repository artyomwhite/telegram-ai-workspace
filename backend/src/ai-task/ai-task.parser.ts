import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  AiTaskIntent,
  AiTaskParseResult,
  ParsedTaskInput,
} from './ai-task.intent';

const PRIORITY_PATTERNS: { pattern: RegExp; priority: TaskPriority }[] = [
  { pattern: /\b(urgent|asap|critical)\b/i, priority: TaskPriority.URGENT },
  { pattern: /\b(high[\s-]?priority|high prio|!{2,})\b/i, priority: TaskPriority.HIGH },
  { pattern: /\bpriority[\s:-]*(high|urgent)\b/i, priority: TaskPriority.HIGH },
  { pattern: /\b(low[\s-]?priority|low prio)\b/i, priority: TaskPriority.LOW },
  { pattern: /\bpriority[\s:-]*low\b/i, priority: TaskPriority.LOW },
  { pattern: /\bmedium[\s-]?priority\b/i, priority: TaskPriority.MEDIUM },
];

const DATE_PATTERNS: { pattern: RegExp; resolve: (m: RegExpMatchArray, now: Date) => Date | undefined }[] = [
  {
    pattern: /\btomorrow(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i,
    resolve: (m, now) => {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      applyTime(d, m[1], m[2], m[3]);
      if (!m[1]) d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    pattern: /\btoday(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i,
    resolve: (m, now) => {
      const d = new Date(now);
      applyTime(d, m[1], m[2], m[3]);
      if (!m[1]) d.setHours(17, 0, 0, 0);
      return d;
    },
  },
  {
    pattern: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    resolve: (m, now) => {
      const d = new Date(now);
      applyTime(d, m[1], m[2], m[3]);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    resolve: (m, now) => nextWeekday(now, m[1]),
  },
  {
    pattern: /\bin\s+(\d+)\s+(day|days|hour|hours)\b/i,
    resolve: (m, now) => {
      const d = new Date(now);
      const n = parseInt(m[1], 10);
      if (m[2].startsWith('day')) d.setDate(d.getDate() + n);
      else d.setHours(d.getHours() + n);
      return d;
    },
  },
];

const STRIP_PATTERNS = [
  /\b(tomorrow|today|next\s+\w+day)\b(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/gi,
  /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  /\bin\s+\d+\s+(?:day|days|hour|hours)\b/gi,
  /\b(urgent|asap|critical|high[\s-]?priority|low[\s-]?priority|medium[\s-]?priority|high prio|low prio)\b/gi,
  /\bpriority[\s:-]*(high|low|medium|urgent)\b/gi,
];

function applyTime(
  d: Date,
  hourStr?: string,
  minuteStr?: string,
  ampm?: string,
) {
  if (!hourStr) return;
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;
  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === 'pm' && hour < 12) hour += 12;
    if (lower === 'am' && hour === 12) hour = 0;
  }
  d.setHours(hour, minute, 0, 0);
}

function nextWeekday(now: Date, dayName: string): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const target = days.indexOf(dayName.toLowerCase());
  const d = new Date(now);
  d.setHours(9, 0, 0, 0);
  let diff = target - d.getDay();
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function detectIntent(input: string): AiTaskIntent {
  const text = input.trim();

  if (/^(show|list|my|view)\s+(tasks|to-?dos?)\b/i.test(text)) return AiTaskIntent.LIST_TASKS;
  if (/^(what are|what's)\s+my\s+tasks/i.test(text)) return AiTaskIntent.LIST_TASKS;
  if (/^\/tasks\b/i.test(text)) return AiTaskIntent.LIST_TASKS;

  if (/^(complete|done|finish|mark\s+.+\s+(?:as\s+)?(?:done|complete))\b/i.test(text)) {
    return AiTaskIntent.COMPLETE_TASK;
  }
  if (/^(delete|remove|cancel)\s+(?:task\s+)?/i.test(text)) return AiTaskIntent.DELETE_TASK;

  if (/^(update|change|set)\s+(?:task\s+)?/i.test(text)) return AiTaskIntent.UPDATE_TASK;

  if (text.length > 2) return AiTaskIntent.CREATE_TASK;

  return AiTaskIntent.UNKNOWN;
}

export function extractTaskRef(input: string): string | undefined {
  const byId = input.match(/\b(c[a-z0-9]{20,})\b/i);
  if (byId) return byId[1];

  const byNumber = input.match(/\b(?:task\s+)?#?(\d{1,3})\b/i);
  if (byNumber && !/^\d{1,2}:\d{2}/.test(byNumber[0])) return byNumber[1];

  const quoted = input.match(/["'](.+?)["']/);
  if (quoted) return quoted[1];

  const afterVerb = input.match(
    /^(?:complete|done|finish|delete|remove|cancel|update|change|set)\s+(?:task\s+)?(.+)$/i,
  );
  if (afterVerb) {
    const ref = afterVerb[1]
      .replace(/\b(priority|status|to)\s+.+/i, '')
      .trim();
    if (ref && ref.length < 80) return ref;
  }

  return undefined;
}

export function extractUpdates(input: string): ParsedTaskInput['updates'] {
  const updates: ParsedTaskInput['updates'] = {};
  const priorityMatch = input.match(/\bpriority\s*(?:=|:|\s)\s*(urgent|high|medium|low)\b/i);
  if (priorityMatch) {
    updates.priority = priorityMatch[1].toUpperCase() as TaskPriority;
  }
  const statusMatch = input.match(/\bstatus\s*(?:=|:|\s)\s*([\w_]+)\b/i);
  if (statusMatch) {
    const s = statusMatch[1].toUpperCase().replace(/ /g, '_');
    if (Object.values(TaskStatus).includes(s as TaskStatus)) {
      updates.status = s as TaskStatus;
    }
  }
  const titleMatch = input.match(/\btitle\s*(?:=|:|\s)\s*(.+)$/i);
  if (titleMatch) updates.title = titleMatch[1].trim();
  return Object.keys(updates).length ? updates : undefined;
}

export function parseTaskInput(input: string, now = new Date()): AiTaskParseResult {
  const rawInput = input.trim();
  const intent = detectIntent(rawInput);

  let priority: TaskPriority | undefined;
  for (const { pattern, priority: p } of PRIORITY_PATTERNS) {
    if (pattern.test(rawInput)) {
      priority = p;
      break;
    }
  }

  let datetime: Date | undefined;
  for (const { pattern, resolve } of DATE_PATTERNS) {
    const match = rawInput.match(pattern);
    if (match) {
      datetime = resolve(match, now);
      break;
    }
  }

  let title = rawInput;
  for (const pattern of STRIP_PATTERNS) {
    title = title.replace(pattern, ' ');
  }
  title = title
    .replace(/^(?:\/newtask|new task|add task|create task|task:?)\s*/i, '')
    .replace(/^(?:complete|done|finish|delete|remove|cancel|update|change|set)\s+(?:task\s+)?/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (intent === AiTaskIntent.CREATE_TASK && !title) {
    title = rawInput;
  }

  let confidence = 0.5;
  if (intent === AiTaskIntent.CREATE_TASK && title.length >= 3) confidence = 0.75;
  if (priority) confidence += 0.1;
  if (datetime) confidence += 0.12;
  if (intent !== AiTaskIntent.UNKNOWN && intent !== AiTaskIntent.CREATE_TASK) {
    confidence = extractTaskRef(rawInput) ? 0.85 : 0.55;
  }
  if (intent === AiTaskIntent.LIST_TASKS) confidence = 0.9;
  confidence = Math.min(0.98, confidence);

  return {
    rawInput,
    intent,
    title: title || rawInput,
    datetime,
    priority,
    type: 'TASK',
    confidence,
    taskRef: extractTaskRef(rawInput),
    updates: extractUpdates(rawInput),
  };
}
