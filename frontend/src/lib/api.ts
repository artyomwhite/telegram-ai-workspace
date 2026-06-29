import { authStorage } from './auth-storage';
import type {
  AuthResponse,
  Company,
  Contact,
  PaginatedResponse,
  Reminder,
  Statistics,
  Task,
  TelegramConnection,
  User,
  ActivityLog,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    authStorage.clear();
    return null;
  }

  const data: AuthResponse = await res.json();
  authStorage.setTokens(data.accessToken, data.refreshToken, data.user);
  return data.accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = authStorage.getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, false);
    }
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { message?: string | string[] }).message ?? res.statusText;
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : String(message),
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  getProfile: () => request<User>('/users/me'),

  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    request<User>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),

  getStatistics: () => request<Statistics>('/statistics'),

  getContacts: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return request<PaginatedResponse<Contact>>(`/contacts?${q}`);
  },

  createContact: (data: Partial<Contact>) =>
    request<Contact>('/contacts', { method: 'POST', body: JSON.stringify(data) }),

  updateContact: (id: string, data: Partial<Contact>) =>
    request<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteContact: (id: string) =>
    request<{ success: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),

  getCompanies: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return request<PaginatedResponse<Company>>(`/companies?${q}`);
  },

  createCompany: (data: Partial<Company>) =>
    request<Company>('/companies', { method: 'POST', body: JSON.stringify(data) }),

  updateCompany: (id: string, data: Partial<Company>) =>
    request<Company>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCompany: (id: string) =>
    request<{ success: boolean }>(`/companies/${id}`, { method: 'DELETE' }),

  getTasks: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    priority?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.priority) q.set('priority', params.priority);
    return request<PaginatedResponse<Task>>(`/tasks?${q}`);
  },

  createTask: (data: Partial<Task>) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  getReminders: (params?: { page?: number; limit?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    return request<PaginatedResponse<Reminder>>(`/reminders?${q}`);
  },

  createReminder: (data: Partial<Reminder>) =>
    request<Reminder>('/reminders', { method: 'POST', body: JSON.stringify(data) }),

  updateReminder: (id: string, data: Partial<Reminder>) =>
    request<Reminder>(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteReminder: (id: string) =>
    request<{ success: boolean }>(`/reminders/${id}`, { method: 'DELETE' }),

  getActivity: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return request<PaginatedResponse<ActivityLog>>(`/activity?${q}`);
  },

  getTelegramConnection: () => request<TelegramConnection | null>('/telegram/connection'),

  setupTelegramWebhook: () =>
    request<Record<string, unknown>>('/telegram/webhook/setup', { method: 'POST' }),

  disconnectTelegram: () =>
    request<{ success: boolean }>('/telegram/disconnect', { method: 'POST' }),
};

export { ApiError };
