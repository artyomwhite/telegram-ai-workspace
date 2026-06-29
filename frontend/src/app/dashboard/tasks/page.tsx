'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { Task } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { CrudModal, Pagination, SearchBar } from '@/components/ui/CrudModal';
import { EmptyState, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const DUE_DATE_OPTIONS = [
  { value: '', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'This week' },
];

const PRIORITY_GROUPS: { key: Task['priority']; label: string; emoji: string }[] = [
  { key: 'URGENT', label: 'Urgent', emoji: '🔥' },
  { key: 'HIGH', label: 'High priority', emoji: '🔥' },
  { key: 'MEDIUM', label: 'Medium', emoji: '🟡' },
  { key: 'LOW', label: 'Low', emoji: '🟢' },
];

function matchesDueFilter(task: Task, filter: string): boolean {
  if (!filter || !task.dueDate) return filter === '';
  const due = new Date(task.dueDate);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  if (filter === 'overdue') return due < startOfToday;
  if (filter === 'today') return due >= startOfToday && due <= endOfToday;
  if (filter === 'week') return due >= startOfToday && due <= endOfWeek;
  return true;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTasks({
        page,
        limit: 50,
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setTasks(items);
      setTotalPages(res?.meta?.totalPages ?? 1);
    } catch (error) {
      console.error('TASKS API ERROR:', error);
      setTasks([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const filteredTasks = useMemo(
    () => tasks.filter((t) => matchesDueFilter(t, dueFilter)),
    [tasks, dueFilter],
  );

  const groupedTasks = useMemo(() => {
    const groups = new Map<Task['priority'], Task[]>();
    for (const g of PRIORITY_GROUPS) groups.set(g.key, []);
    for (const task of filteredTasks) {
      const list = groups.get(task.priority) ?? [];
      list.push(task);
      groups.set(task.priority, list);
    }
    return PRIORITY_GROUPS.map((g) => ({
      ...g,
      tasks: groups.get(g.key) ?? [],
    })).filter((g) => g.tasks.length > 0);
  }, [filteredTasks]);

  const fields = [
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' as const },
    {
      name: 'status',
      label: 'Status',
      type: 'select' as const,
      options: STATUS_OPTIONS.filter((o) => o.value),
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'select' as const,
      options: PRIORITY_OPTIONS.filter((o) => o.value),
    },
    { name: 'dueDate', label: 'Due Date', type: 'date' as const },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    const payload = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
    };
    if (editing) {
      await api.updateTask(editing.id, payload);
    } else {
      await api.createTask({ ...payload, status: (data.status as Task['status']) || 'TODO' });
    }
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    await api.deleteTask(id);
    await load();
  };

  const handleAiCreate = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const parsed = await api.parseTask(aiInput.trim());
      await api.createTask({
        title: parsed.createPayload.title,
        priority: parsed.createPayload.priority as Task['priority'] | undefined,
        status: (parsed.createPayload.status as Task['status']) ?? 'TODO',
        dueDate: parsed.createPayload.dueDate,
      });
      setAiInput('');
      await load();
    } catch (error) {
      console.error('AI task create failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const renderTaskRow = (t: Task) => (
    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
      <td className="px-6 py-4">
        <p className="font-medium text-slate-900">{t.title}</p>
        {t.company && <p className="text-xs text-slate-400">{t.company.name}</p>}
      </td>
      <td className="px-6 py-4"><Badge variant={t.status}>{t.status.replace('_', ' ')}</Badge></td>
      <td className="px-6 py-4"><Badge variant={t.priority}>{t.priority}</Badge></td>
      <td className="px-6 py-4 text-slate-600">{formatDate(t.dueDate)}</td>
      <td className="px-6 py-4">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setModalOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="mt-1 text-slate-500">Track and manage your to-dos</p>
          <p className="mt-1 text-xs text-indigo-600">
            Tasks created via Telegram appear instantly
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      <Card className="border-indigo-100 bg-indigo-50/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Sparkles className="hidden h-5 w-5 text-indigo-600 sm:block" />
          <Input
            placeholder='AI quick create: "Call client tomorrow at 5pm high priority"'
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiCreate()}
            className="flex-1 bg-white"
          />
          <Button onClick={handleAiCreate} disabled={aiLoading || !aiInput.trim()}>
            {aiLoading ? 'Parsing…' : 'Create with AI'}
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tasks..." />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-44"
        />
        <Select
          options={PRIORITY_OPTIONS}
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="w-44"
        />
        <Select
          options={DUE_DATE_OPTIONS}
          value={dueFilter}
          onChange={(e) => setDueFilter(e.target.value)}
          className="w-44"
        />
      </div>

      <Card>
        {loading ? (
          <LoadingSpinner />
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            title="Create your first AI-powered task"
            description="Use natural language in Telegram or the AI quick create above. Tasks sync instantly with your dashboard."
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> Add Task
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            {groupedTasks.map((group) => (
              <div key={group.key} className="mb-6 last:mb-0">
                <h3 className="border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-700">
                  {group.emoji} {group.label}
                  <span className="ml-2 font-normal text-slate-400">({group.tasks.length})</span>
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="px-6 py-3 font-medium">Title</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Priority</th>
                      <th className="px-6 py-3 font-medium">Due Date</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>{group.tasks.map(renderTaskRow)}</tbody>
                </table>
              </div>
            ))}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <CrudModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Edit Task' : 'New Task'}
        fields={fields}
        initialData={editing ? {
          title: editing.title,
          description: editing.description ?? '',
          status: editing.status,
          priority: editing.priority,
          dueDate: editing.dueDate ? editing.dueDate.split('T')[0] : '',
        } : { status: 'TODO', priority: 'MEDIUM' }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
