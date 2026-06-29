'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ActivityLog } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/CrudModal';
import { EmptyState, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { timeAgo } from '@/lib/utils';

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getActivity({ page, limit: 20 });
      setLogs(res.data);
      setTotalPages(res.meta.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
        <p className="mt-1 text-slate-500">Track all actions across your workspace</p>
      </div>

      <Card>
        {loading ? (
          <LoadingSpinner />
        ) : logs.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div>
            <ul className="divide-y divide-slate-100">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <Badge variant={log.type}>{log.type}</Badge>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{log.description}</p>
                      <p className="text-xs text-slate-400">{log.entityType}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(log.createdAt)}</span>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
