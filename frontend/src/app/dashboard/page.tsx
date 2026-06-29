'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckSquare,
  Users,
  Bot,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Statistics } from '@/lib/types';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { timeAgo } from '@/lib/utils';

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  href: string;
  subtitle?: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardBody className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
            <Icon className="h-5 w-5 text-indigo-600" />
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getStatistics()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <p className="text-slate-500">Failed to load dashboard</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">Overview of your business activity</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Contacts" value={stats.contacts} icon={Users} href="/dashboard/contacts" />
        <StatCard title="Companies" value={stats.companies} icon={Building2} href="/dashboard/companies" />
        <StatCard
          title="Open Tasks"
          value={stats.tasks.open}
          icon={CheckSquare}
          href="/dashboard/tasks"
          subtitle={`${stats.tasks.completed} completed`}
        />
        <StatCard
          title="Telegram"
          value={stats.telegram.connected ? 'Connected' : 'Not connected'}
          icon={Bot}
          href="/dashboard/telegram"
          subtitle={stats.telegram.username ? `@${stats.telegram.username}` : 'Link your bot'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-slate-900">Task Overview</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {[
                { label: 'To Do', value: stats.tasks.open, variant: 'TODO' },
                { label: 'In Progress', value: stats.tasks.inProgress, variant: 'IN_PROGRESS' },
                { label: 'Completed', value: stats.tasks.completed, variant: 'COMPLETED' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.variant}>{item.label}</Badge>
                  </div>
                  <span className="text-lg font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </CardHeader>
          <CardBody>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity</p>
            ) : (
              <ul className="space-y-3">
                {stats.recentActivity.map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-900">{log.description}</p>
                      <p className="text-xs text-slate-400">{log.entityType}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{timeAgo(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/dashboard/activity"
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all activity →
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
