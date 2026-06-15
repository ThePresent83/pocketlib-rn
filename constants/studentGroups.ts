export type LocalizedText = {
  ru: string;
  kk: string;
  en: string;
};

export interface StudentGroupSeed {
  name: string;
  admissionYear: number;
  courseYear: number;
  specialityCode: string;
  qualificationCode: string;
}

export const STUDENT_GROUP_ACADEMIC_START_YEAR = 2025;

export const SPECIALITY_LOCALIZATIONS: Record<string, LocalizedText> = {
  "06120100": {
    "ru": "Вычислительная техника и информационные сети",
    "kk": "Есептеу техникасы және ақпараттық желілер",
    "en": "Computer Engineering and Information Networks"
  },
  "06120200": {
    "ru": "Системы информационной безопасности",
    "kk": "Ақпараттық қауіпсіздік жүйелері",
    "en": "Information Security Systems"
  },
  "06130100": {
    "ru": "Программное обеспечение",
    "kk": "Бағдарламалық қамтамасыз ету",
    "en": "Software"
  },
  "07140900": {
    "ru": "Радиотехника, электроника и телекоммуникации",
    "kk": "Радиотехника, электроника және телекоммуникациялар",
    "en": "Radio Engineering, Electronics and Telecommunications"
  },
  "07151100": {
    "ru": "Эксплуатация и техническое обслуживание машин и оборудования",
    "kk": "Машиналар мен жабдықтарды пайдалану және техникалық қызмет көрсету",
    "en": "Operation and Maintenance of Machines and Equipment"
  }
};

export const QUALIFICATION_LOCALIZATIONS: Record<string, LocalizedText> = {
  "3W06120101": {
    "ru": "Оператор компьютерного аппаратного обеспечения",
    "kk": "Компьютерлік аппараттық қамтамасыз ету операторы",
    "en": "Computer Hardware Operator"
  },
  "3W06130102": {
    "ru": "Web-дизайнер",
    "kk": "Web-дизайнер",
    "en": "Web Designer"
  },
  "3W07140901": {
    "ru": "Электромонтажник-накладчик телекоммуникационного оборудования и каналов связи",
    "kk": "Телекоммуникациялық жабдықтар мен байланыс арналарының электр монтаждаушы-реттеушісі",
    "en": "Telecommunications Equipment and Communication Channels Electrician-Adjuster"
  },
  "4S06120102": {
    "ru": "Техник сетевого и системного администрирования",
    "kk": "Желілік және жүйелік әкімшілендіру технигі",
    "en": "Network and System Administration Technician"
  },
  "4S06120202": {
    "ru": "Техник по информационной безопасности",
    "kk": "Ақпараттық қауіпсіздік технигі",
    "en": "Information Security Technician"
  },
  "4S06130103": {
    "ru": "Разработчик программного обеспечения",
    "kk": "Бағдарламалық қамтамасыз етуді әзірлеуші",
    "en": "Software Developer"
  },
  "4S06130105": {
    "ru": "Техник информационных систем",
    "kk": "Ақпараттық жүйелер технигі",
    "en": "Information Systems Technician"
  },
  "4S07140902": {
    "ru": "Техник телекоммуникационных систем связи",
    "kk": "Телекоммуникациялық байланыс жүйелері технигі",
    "en": "Telecommunications Systems Technician"
  },
  "4S07140905": {
    "ru": "Техник мультимедийных и цифровых систем",
    "kk": "Мультимедиялық және цифрлық жүйелер технигі",
    "en": "Multimedia and Digital Systems Technician"
  },
  "4S07151102": {
    "ru": "Техник-механик",
    "kk": "Техник-механик",
    "en": "Mechanical Technician"
  }
};

export const STUDENT_GROUP_SEEDS: StudentGroupSeed[] = [
  {
    "name": "ИС22-А",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "ИС22-Б",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "ИС23-А",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "ИС23-Б",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "ИС24",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "ИС25-А",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "ИС25-Б",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "ОП24-А",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "3W06120101"
  },
  {
    "name": "ОП24-Б",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "3W06120101"
  },
  {
    "name": "П22-А",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-Б",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-В",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-Г",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-Д",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-ЕК",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-ЖК",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-ЗК",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П22-ИК",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П23-3С",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "П23-А",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П23-Б",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П23-В",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П23-Г",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П23-Д",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П23-Е",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П23-ЖК",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П24-2С",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "П24-А",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П24-Б",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П24-В",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П24-Г",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П24-Д",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П24-ЖК",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П25-1С",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130105"
  },
  {
    "name": "П25-А",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П25-Б",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П25-В",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П25-Г",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "П25-ДК",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "4S06130103"
  },
  {
    "name": "РЭТ22",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "07140900",
    "qualificationCode": "4S07140905"
  },
  {
    "name": "РЭТ23",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "07140900",
    "qualificationCode": "4S07140905"
  },
  {
    "name": "РЭТ24",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "07140900",
    "qualificationCode": "4S07140905"
  },
  {
    "name": "РЭТ25",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "07140900",
    "qualificationCode": "4S07140902"
  },
  {
    "name": "С25",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "07140900",
    "qualificationCode": "3W07140901"
  },
  {
    "name": "Т22-А",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т22-Б",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т23-А",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т23-Б",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т23-В",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т24",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т25",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т25-1",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т25-4В",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "Т25-4Г",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06120100",
    "qualificationCode": "4S06120102"
  },
  {
    "name": "ТЗИ22",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "06120200",
    "qualificationCode": "4S06120202"
  },
  {
    "name": "ТЗИ24",
    "admissionYear": 2024,
    "courseYear": 2,
    "specialityCode": "06120200",
    "qualificationCode": "4S06120202"
  },
  {
    "name": "ТЗИ25",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06120200",
    "qualificationCode": "4S06120202"
  },
  {
    "name": "ТМ22",
    "admissionYear": 2022,
    "courseYear": 4,
    "specialityCode": "07151100",
    "qualificationCode": "4S07151102"
  },
  {
    "name": "ТМ23",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "07151100",
    "qualificationCode": "4S07151102"
  },
  {
    "name": "ТМ25",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "07151100",
    "qualificationCode": "4S07151102"
  },
  {
    "name": "ЭВМ23-А",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06120100",
    "qualificationCode": "3W06120101"
  },
  {
    "name": "ЭВМ23-Б",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06120100",
    "qualificationCode": "3W06120101"
  },
  {
    "name": "ЭВМ23-В",
    "admissionYear": 2023,
    "courseYear": 3,
    "specialityCode": "06120100",
    "qualificationCode": "3W06120101"
  },
  {
    "name": "WEB25-А",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "3W06130102"
  },
  {
    "name": "WEB25-Б",
    "admissionYear": 2025,
    "courseYear": 1,
    "specialityCode": "06130100",
    "qualificationCode": "3W06130102"
  }
];
