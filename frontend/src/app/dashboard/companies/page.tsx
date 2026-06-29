'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import type { Company } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CrudModal, Pagination, SearchBar } from '@/components/ui/CrudModal';
import { EmptyState, LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCompanies({ page, limit: 10, search: search || undefined });
      setCompanies(res.data);
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
    { name: 'name', label: 'Company Name', required: true },
    { name: 'industry', label: 'Industry' },
    { name: 'website', label: 'Website' },
    { name: 'email', label: 'Email', type: 'email' as const },
    { name: 'phone', label: 'Phone', type: 'tel' as const },
    { name: 'address', label: 'Address' },
    { name: 'description', label: 'Description', type: 'textarea' as const },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    if (editing) {
      await api.updateCompany(editing.id, data);
    } else {
      await api.createCompany(data);
    }
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this company?')) return;
    await api.deleteCompany(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="mt-1 text-slate-500">Track organizations you work with</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </div>

      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search companies..." />

      <Card>
        {loading ? (
          <LoadingSpinner />
        ) : companies.length === 0 ? (
          <EmptyState title="No companies yet" description="Add your first company to get started" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Industry</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Contacts</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                    <td className="px-6 py-4 text-slate-600">{c.industry ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{c.email ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{c._count?.contacts ?? 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setModalOpen(true); }}>
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
        title={editing ? 'Edit Company' : 'New Company'}
        fields={fields}
        initialData={editing ? {
          name: editing.name,
          industry: editing.industry ?? '',
          website: editing.website ?? '',
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          address: editing.address ?? '',
          description: editing.description ?? '',
        } : {}}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
