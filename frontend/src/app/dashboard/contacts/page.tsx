'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import type { Contact } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CrudModal, Pagination, SearchBar } from '@/components/ui/CrudModal';
import { EmptyState, LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getContacts({ page, limit: 10, search: search || undefined });
      setContacts(res.data);
      setTotalPages(res.meta.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const fields = [
    { name: 'firstName', label: 'First Name', required: true },
    { name: 'lastName', label: 'Last Name', required: true },
    { name: 'email', label: 'Email', type: 'email' as const },
    { name: 'phone', label: 'Phone', type: 'tel' as const },
    { name: 'position', label: 'Position' },
    { name: 'notes', label: 'Notes', type: 'textarea' as const },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    if (editing) {
      await api.updateContact(editing.id, data);
    } else {
      await api.createContact(data);
    }
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    await api.deleteContact(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="mt-1 text-slate-500">Manage your business contacts</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search contacts..." />

      <Card>
        {loading ? (
          <LoadingSpinner />
        ) : contacts.length === 0 ? (
          <EmptyState title="No contacts yet" description="Add your first contact to get started" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Company</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{c.email ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{c.phone ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{c.company?.name ?? '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditing(c); setModalOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
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
        title={editing ? 'Edit Contact' : 'New Contact'}
        fields={fields}
        initialData={editing ? {
          firstName: editing.firstName,
          lastName: editing.lastName,
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          position: editing.position ?? '',
          notes: editing.notes ?? '',
        } : {}}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
