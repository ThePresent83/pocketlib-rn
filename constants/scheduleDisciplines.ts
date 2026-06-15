import type { LocalizedText } from './studentGroups';

export interface ScheduleDisciplineSeed {
  name: LocalizedText;
}

function ro(code: string): ScheduleDisciplineSeed {
  const name = `РО ${code}`;
  return { name: { ru: name, kk: name, en: name } };
}

const RO_CODES = [
  '1.1',
  '1.2',
  '1.3',
  '1.4',
  '2.1',
  '2.2',
  '2.3',
  '3.1',
  '3.2',
  '3.3',
  '3.4',
  '3.5',
  '4.1',
  '4.2',
  '4.3',
  '4.4',
  '5.1',
  '5.2',
  '5.3',
  '6.1',
  '6.2',
  '7.1',
  '7.2',
];

export const SCHEDULE_DISCIPLINE_SEEDS: readonly ScheduleDisciplineSeed[] = [
  { name: { ru: 'Английский язык', kk: 'Ағылшын тілі', en: 'English' } },
  { name: { ru: 'Всемирная история', kk: 'Дүниежүзі тарихы', en: 'World History' } },
  { name: { ru: 'География', kk: 'География', en: 'Geography' } },
  { name: { ru: 'Глобальные компетенции', kk: 'Жаһандық құзыреттер', en: 'Global Competencies' } },
  { name: { ru: 'Дипломное проектирование', kk: 'Дипломдық жобалау', en: 'Diploma Project' } },
  { name: { ru: 'Казахский язык и литература', kk: 'Қазақ тілі мен әдебиеті', en: 'Kazakh Language and Literature' } },
  { name: { ru: 'Консультация', kk: 'Консультация', en: 'Consultation' } },
  { name: { ru: 'Литература', kk: 'Әдебиет', en: 'Literature' } },
  { name: { ru: 'Математика', kk: 'Математика', en: 'Mathematics' } },
  { name: { ru: 'Русский язык и литература', kk: 'Орыс тілі мен әдебиеті', en: 'Russian Language and Literature' } },
  { name: { ru: 'Факультатив', kk: 'Факультатив', en: 'Elective' } },
  { name: { ru: 'Физика', kk: 'Физика', en: 'Physics' } },
  { name: { ru: 'Химия', kk: 'Химия', en: 'Chemistry' } },
  ...RO_CODES.map(ro),
];
