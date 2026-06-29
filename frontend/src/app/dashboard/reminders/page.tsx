'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Reminder } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CrudModal, Pagination } from '@/components/ui/CrudModal';
import { EmptyState, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDateTime } from '@/lib/utils';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getReminders({ page, limit: 10 });
      setReminders(res.data);
      setTotalPages(res.meta.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const fields = [
    { name: 'title', label: 'Title', required: true },
    { name: 'message', label: 'Message', type: 'textarea' as const },
    { name: 'remindAt', label: 'Remind At', type: 'datetime-local' as const, required: true },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    await api.createReminder({
      title: data.title,
      message: data.message,
      remindAt: new Date(data.remindAt).toISOString(),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reminder?')) return;
    await api.deleteReminder(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reminders</h1>
          <p className="mt-1 text-slate-500">Schedule follow-ups and notifications</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Reminder
        </Button>
      </div>

      <Card>
        {loading ? (
          <LoadingSpinner />
        ) : reminders.length === 0 ? (
          <EmptyState title="No reminders" description="Set a reminder to stay on top of things" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Remind At</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{r.title}</p>
                      {r.message && <p className="text-xs text-slate-400">{r.message}</p>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{formatDateTime(r.remindAt)}</td>
                    <td className="px-6 py-4"><Badge variant={r.status}>{r.status}</Badge></td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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
        onClose={() => setModalOpen(false)}
        title="New Reminder"
        fields={fields}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
