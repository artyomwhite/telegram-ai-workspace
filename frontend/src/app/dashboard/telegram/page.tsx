'use client';

import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, XCircle, Link2, Unlink } from 'lucide-react';
import { api } from '@/lib/api';
import type { TelegramConnection } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDateTime } from '@/lib/utils';

const COMMANDS = [
  { cmd: '/start', desc: 'Welcome message and onboarding' },
  { cmd: '/connect <email>', desc: 'Link your dashboard account' },
  { cmd: '/help', desc: 'List all available commands' },
  { cmd: '/newtask <title>', desc: 'Create a new task' },
  { cmd: '/tasks', desc: 'List open tasks' },
  { cmd: '/remind <title> | <datetime>', desc: 'Set a reminder' },
  { cmd: '/contact <name>', desc: 'Quick add a contact' },
  { cmd: '/company <name>', desc: 'Quick add a company' },
  { cmd: '/search <query>', desc: 'Search across your data' },
  { cmd: '/stats', desc: 'View business statistics' },
];

export default function TelegramPage() {
  const [connection, setConnection] = useState<TelegramConnection | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const conn = await api.getTelegramConnection();
      setConnection(conn);
    } catch {
      setConnection(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await api.disconnectTelegram();
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Telegram Integration</h1>
        <p className="mt-1 text-slate-500">Manage your Telegram bot connection</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Connection Status</h2>
              <p className="text-sm text-slate-500">Link your Telegram account to manage business on the go</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {connection ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <div>
                  <p className="font-medium text-slate-900">
                    Connected {connection.telegramUsername ? `@${connection.telegramUsername}` : ''}
                  </p>
                  <p className="text-sm text-slate-500">
                    Since {formatDateTime(connection.connectedAt)}
                  </p>
                </div>
              </div>
              <Button variant="danger" size="sm" loading={actionLoading} onClick={handleDisconnect}>
                <Unlink className="h-4 w-4" /> Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 shrink-0 text-slate-400" />
              <div>
                <p className="font-medium text-slate-900">Not connected</p>
                <p className="mt-1 text-sm text-slate-500">
                  Open your Telegram bot and send:
                </p>
                <code className="mt-2 inline-block rounded bg-slate-100 px-3 py-1.5 text-sm text-indigo-700">
                  /connect your@email.com
                </code>
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <Link2 className="h-3 w-3" /> Use the email from your dashboard account
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">Bot Commands</h2>
        </CardHeader>
        <CardBody>
          <div className="divide-y divide-slate-100">
            {COMMANDS.map(({ cmd, desc }) => (
              <div key={cmd} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <code className="rounded bg-slate-100 px-2 py-1 text-sm font-mono text-indigo-700">{cmd}</code>
                <span className="text-sm text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
