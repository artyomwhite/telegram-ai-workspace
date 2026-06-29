'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await api.updateProfile(form);
      await refreshUser();
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">Manage your account preferences</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <h2 className="font-semibold text-slate-900">Profile</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" value={user?.email ?? ''} disabled />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            {message && (
              <p className={`text-sm ${message.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>
                {message}
              </p>
            )}
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
