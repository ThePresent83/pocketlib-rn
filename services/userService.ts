import { apiRequest, AuthTokens, clearStoredTokens, getStoredTokens, setStoredTokens } from './backendApi';
import { EntityId } from './disciplineService';

export interface User {
  id: EntityId;
  full_name: string;
  email: string;
  login?: string;
  role: 'student' | 'teacher' | 'admin';
  speciality_id?: EntityId;
  course_id?: EntityId;
  group_name?: string;
  group_id?: EntityId;
  created_at?: string;
}

interface AuthResult {
  user: {
    id: EntityId;
    login?: string;
    email?: string;
    full_name?: string;
    role: User['role'];
  };
  tokens: AuthTokens;
}

function normalizeUser(input: any): User {
  return {
    id: input.id,
    login: input.login,
    email: input.email || input.login,
    full_name: input.full_name || input.login || input.email,
    role: normalizeRole(input.role),
    group_id: input.group_id,
    group_name: input.group_name,
    created_at: input.created_at,
  };
}

function normalizeRole(role: string): User['role'] {
  const value = String(role || '').toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'teacher') return 'teacher';
  return 'student';
}

async function applyAuthResult(result: AuthResult): Promise<User> {
  await setStoredTokens(result.tokens);
  return normalizeUser(result.user);
}

export async function login(email: string, password: string): Promise<User | null> {
  try {
    const result = await apiRequest<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, login: email, password }),
    }, false);
    return applyAuthResult(result);
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

export async function register(data: {
  full_name: string;
  email: string;
  password: string;
  role?: string;
  speciality_id?: EntityId;
  course_id?: EntityId;
  group_name?: string;
  group_id?: EntityId;
}): Promise<User | null> {
  try {
    const result = await apiRequest<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: data.full_name,
        email: data.email,
        login: data.email,
        password: data.password,
        group_id: data.group_id,
      }),
    }, false);
    return applyAuthResult(result);
  } catch (error) {
    console.error('Registration error:', error);
    return null;
  }
}

export async function restoreSession(): Promise<User | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  try {
    const user = await apiRequest<any>('/auth/me');
    return normalizeUser(user);
  } catch (error) {
    console.error('Session restore error:', error);
    await clearStoredTokens();
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Local token cleanup is enough if the server is offline.
  } finally {
    await clearStoredTokens();
  }
}

export async function getUserById(id: EntityId): Promise<User | null> {
  try {
    const user = await apiRequest<any>(`/users/${encodeURIComponent(id)}`);
    return normalizeUser(user);
  } catch {
    return null;
  }
}

export async function getAllUsers(): Promise<User[]> {
  const users = await apiRequest<any[]>('/users?limit=200');
  return users.map(normalizeUser);
}

export async function updateUserRole(id: EntityId, role: User['role']): Promise<void> {
  await apiRequest(`/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deleteUser(id: EntityId): Promise<void> {
  await apiRequest(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

