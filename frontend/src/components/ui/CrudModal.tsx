'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface Field {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'datetime-local' | 'textarea' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface CrudModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: Field[];
  initialData?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitLabel?: string;
}

export function CrudModal({
  open,
  onClose,
  title,
  fields,
  initialData = {},
  onSubmit,
  submitLabel = 'Save',
}: CrudModalProps) {
  const [form, setForm] = useState<Record<string, string>>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initialData);
      setError('');
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => {
          const value = form[field.name] ?? initialData[field.name] ?? '';
          if (field.type === 'textarea') {
            return (
              <div key={field.name} className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">{field.label}</label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[80px]"
                  value={value}
                  onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                  required={field.required}
                  placeholder={field.placeholder}
                />
              </div>
            );
          }
          if (field.type === 'select' && field.options) {
            return (
              <Select
                key={field.name}
                label={field.label}
                options={field.options}
                value={value}
                onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                required={field.required}
              />
            );
          }
          return (
            <Input
              key={field.name}
              label={field.label}
              type={field.type ?? 'text'}
              value={value}
              onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
              required={field.required}
              placeholder={field.placeholder}
            />
          );
        })}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: SearchBarProps) {
  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-xs"
    />
  );
}
