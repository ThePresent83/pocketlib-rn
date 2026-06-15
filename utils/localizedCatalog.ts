import type { AppLanguage } from '../contexts/LanguageContext';
import type { Course, CourseWithDiscipline, Discipline, StudentGroup } from '../services/disciplineService';

type Translate = (key: string) => string;

function localizeName(base?: string, kk?: string, en?: string, language: AppLanguage = 'ru') {
  if (language === 'kk') return kk || base || en || '';
  if (language === 'en') return en || base || kk || '';
  return base || kk || en || '';
}

function withCode(code?: string, name?: string) {
  const cleanName = name?.trim();
  if (!cleanName) return code || '';
  return code ? `${code} ${cleanName}` : cleanName;
}

export function getLocalizedDisciplineName(discipline: Discipline | CourseWithDiscipline | StudentGroup, language: AppLanguage) {
  const aliased = discipline as CourseWithDiscipline | StudentGroup;
  if (aliased.discipline_name || aliased.discipline_name_kk || aliased.discipline_name_en || aliased.discipline_code) {
    return withCode(
      aliased.discipline_code,
      localizeName(aliased.discipline_name, aliased.discipline_name_kk, aliased.discipline_name_en, language)
    );
  }

  const base = discipline as Discipline;
  return withCode(base.code, localizeName(base.name, base.name_kk, base.name_en, language));
}

export function getLocalizedCourseName(course: Course | CourseWithDiscipline | StudentGroup, language: AppLanguage) {
  const aliased = course as StudentGroup;
  if (aliased.course_name || aliased.course_name_kk || aliased.course_name_en || aliased.course_code) {
    return withCode(aliased.course_code, localizeName(aliased.course_name, aliased.course_name_kk, aliased.course_name_en, language));
  }

  const base = course as Course;
  return withCode(base.code, localizeName(base.name, base.name_kk, base.name_en, language));
}

export function formatStudentGroupDescription(group: StudentGroup, language: AppLanguage, t: Translate) {
  const courseYear = group.course_year ? `${group.course_year} ${t('course')}` : t('course');
  const courseName = getLocalizedCourseName(group, language) || t('course');
  const disciplineName = getLocalizedDisciplineName(group, language) || t('discipline');

  return `${courseYear} · ${courseName} · ${disciplineName}`;
}
