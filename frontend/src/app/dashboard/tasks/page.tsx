'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import type { Task } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
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
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTasks({
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setTasks(res.data);
      setTotalPages(res.meta.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

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
      options: PRIORITY_OPTIONS,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="mt-1 text-slate-500">Track and manage your to-dos</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tasks..." />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-44"
        />
      </div>

      <Card>
        {loading ? (
          <LoadingSpinner />
        ) : tasks.length === 0 ? (
          <EmptyState title="No tasks yet" description="Create your first task to get started" />
        ) : (
          <div className="overflow-x-auto">
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
              <tbody>
                {tasks.map((t) => (
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
                ))}
              </tbody>
            </table>
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
