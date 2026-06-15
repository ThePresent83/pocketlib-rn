import { apiRequest } from './backendApi';

export type EntityId = string;

export interface Discipline {
  id: EntityId;
  name: string;
  code?: string;
  name_kk?: string;
  name_en?: string;
  color: string;
}

export interface Course {
  id: EntityId;
  name: string;
  year: number;
  discipline_id: EntityId;
  code?: string;
  name_kk?: string;
  name_en?: string;
}

export interface CourseWithDiscipline extends Course {
  discipline_name?: string;
  discipline_code?: string;
  discipline_name_kk?: string;
  discipline_name_en?: string;
  discipline_color?: string;
}

export interface StudentGroup {
  id: EntityId;
  name: string;
  course_id: EntityId;
  admission_year?: number;
  course_code?: string;
  course_name?: string;
  course_name_kk?: string;
  course_name_en?: string;
  course_year?: number;
  discipline_id?: EntityId;
  discipline_code?: string;
  discipline_name?: string;
  discipline_name_kk?: string;
  discipline_name_en?: string;
  discipline_color?: string;
}

export interface Speciality {
  id: EntityId;
  name: string;
}

export interface Category {
  id: EntityId;
  name: string;
}

export interface LocalizedCatalogInput {
  code?: string;
  name_kk?: string;
  name_en?: string;
}

export async function getAllDisciplines(): Promise<Discipline[]> {
  return apiRequest<Discipline[]>('/disciplines', {}, false);
}

export async function getCoursesForDiscipline(disciplineId: EntityId): Promise<Course[]> {
  const courses = await apiRequest<CourseWithDiscipline[]>(
    `/courses?discipline_id=${encodeURIComponent(disciplineId)}`,
    {},
    false
  );
  return courses;
}

export async function getAllCoursesWithDisciplines(): Promise<CourseWithDiscipline[]> {
  return apiRequest<CourseWithDiscipline[]>('/courses', {}, false);
}

export async function addDiscipline(name: string, color: string, localized: LocalizedCatalogInput = {}): Promise<void> {
  await apiRequest('/disciplines', {
    method: 'POST',
    body: JSON.stringify({ name, color, ...localized }),
  });
}

export async function deleteDiscipline(id: EntityId): Promise<void> {
  await apiRequest(`/disciplines/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addCourse(name: string, year: number, disciplineId: EntityId, localized: LocalizedCatalogInput = {}): Promise<void> {
  await apiRequest('/courses', {
    method: 'POST',
    body: JSON.stringify({ name, year, discipline_id: disciplineId, ...localized }),
  });
}

export async function deleteCourse(id: EntityId): Promise<void> {
  await apiRequest(`/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getAllGroups(): Promise<StudentGroup[]> {
  return apiRequest<StudentGroup[]>('/groups?limit=500', {}, false);
}

export async function getGroupById(id: EntityId): Promise<StudentGroup | null> {
  try {
    return await apiRequest<StudentGroup>(`/groups/${encodeURIComponent(id)}`, {}, false);
  } catch {
    return null;
  }
}

export async function addGroup(name: string, courseId: EntityId, admissionYear?: number): Promise<void> {
  await apiRequest('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, course_id: courseId, admission_year: admissionYear }),
  });
}

export async function deleteGroup(id: EntityId): Promise<void> {
  await apiRequest(`/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getAllSpecialities(): Promise<Speciality[]> {
  const disciplines = await getAllDisciplines();
  return disciplines.map((discipline) => ({ id: discipline.id, name: discipline.name }));
}

export async function addSpeciality(name: string): Promise<void> {
  await addDiscipline(name, '#5C6BC0');
}

export async function deleteSpeciality(id: EntityId): Promise<void> {
  await deleteDiscipline(id);
}

export async function getAllCategories(): Promise<Category[]> {
  return apiRequest<Category[]>('/categories', {}, false);
}

export async function addCategory(name: string): Promise<void> {
  await apiRequest('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function deleteCategory(id: EntityId): Promise<void> {
  await apiRequest(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
