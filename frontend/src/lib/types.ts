export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  companyId?: string | null;
  notes?: string | null;
  company?: Company | null;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  createdAt: string;
  _count?: { contacts: number; tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  contact?: Contact | null;
  company?: Company | null;
}

export interface Reminder {
  id: string;
  title: string;
  message?: string | null;
  remindAt: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  taskId?: string | null;
  task?: Task | null;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  type: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  createdAt: string;
}

export interface Statistics {
  contacts: number;
  companies: number;
  tasks: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
  };
  reminders: { pending: number };
  notes: number;
  telegram: {
    connected: boolean;
    username: string | null;
    connectedAt: string | null;
  };
  recentActivity: ActivityLog[];
}

export interface TelegramConnection {
  id: string;
  telegramUserId: string;
  telegramUsername?: string | null;
  isActive: boolean;
  connectedAt: string;
}
