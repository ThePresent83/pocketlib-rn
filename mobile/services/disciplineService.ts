import { getDb } from './db';

export interface Discipline {
  id: number;
  name: string;
  color: string;
}

export interface Course {
  id: number;
  name: string;
  year: number;
  discipline_id: number;
}

export async function getAllDisciplines(): Promise<Discipline[]> {
  const db = await getDb();
  const result = await db.getAllAsync('SELECT * FROM disciplines ORDER BY id');
  return result as Discipline[];
}

export async function getCoursesForDiscipline(disciplineId: number): Promise<Course[]> {
  const db = await getDb();
  const result = await db.getAllAsync('SELECT * FROM courses WHERE discipline_id = ? ORDER BY year, name', [disciplineId]);
  return result as Course[];
}

export async function addDiscipline(name: string, color: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO disciplines (name, color) VALUES (?, ?)', [name, color]);
}

export async function deleteDiscipline(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM disciplines WHERE id = ?', [id]);
}

export async function addCourse(name: string, year: number, disciplineId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO courses (name, year, discipline_id) VALUES (?, ?, ?)', [name, year, disciplineId]);
}

export async function deleteCourse(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM courses WHERE id = ?', [id]);
}

export interface Speciality {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
}

export async function getAllSpecialities(): Promise<Speciality[]> {
  const db = await getDb();
  const result = await db.getAllAsync('SELECT * FROM specialities ORDER BY name');
  return result as Speciality[];
}

export async function addSpeciality(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO specialities (name) VALUES (?)', [name]);
}

export async function deleteSpeciality(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM specialities WHERE id = ?', [id]);
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  const result = await db.getAllAsync('SELECT * FROM categories ORDER BY name');
  return result as Category[];
}

export async function addCategory(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO categories (name) VALUES (?)', [name]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}
