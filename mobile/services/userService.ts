import { getDb } from './db';

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  speciality_id?: number;
  course_id?: number;
  group_name?: string;
  created_at: string;
}

export async function login(email: string, password: string): Promise<User | null> {
  const db = await getDb();
  // В MVP используем простое сравнение паролей. В реальном приложении использовать bcrypt.
  const user = await db.getFirstAsync('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user as any;
    return userWithoutPassword as User;
  }
  return null;
}

export async function register(data: { full_name: string, email: string, password: string, role?: string, speciality_id?: number, course_id?: number, group_name?: string }): Promise<User | null> {
  const db = await getDb();
  
  try {
    const result = await db.runAsync(`
      INSERT INTO users (full_name, email, password, role, speciality_id, course_id, group_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.full_name, 
      data.email, 
      data.password, 
      data.role || 'student',
      data.speciality_id || null,
      data.course_id || null,
      data.group_name || null
    ]);

    const user = await db.getFirstAsync('SELECT * FROM users WHERE id = ?', [result.lastInsertRowId]);
    if (user) {
      const { password: _, ...userWithoutPassword } = user as any;
      return userWithoutPassword as User;
    }
    return null;
  } catch (error) {
    console.error('Registration error:', error);
    return null;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  const db = await getDb();
  const user = await db.getFirstAsync('SELECT * FROM users WHERE id = ?', [id]);
  if (user) {
    const { password: _, ...userWithoutPassword } = user as any;
    return userWithoutPassword as User;
  }
  return null;
}
