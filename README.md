# PocketLib

PocketLib - мобильная библиотечная система для колледжа на React Native/Expo с Go backend, PostgreSQL и MinIO.

## Быстрый старт

```powershell
npm install
npm run dev:pocketlib
```

Backend health:

```powershell
Invoke-RestMethod http://localhost:8080/health
```

Стартовый администратор:

```text
admin@university.edu
admin123
```

## APK

```powershell
npm run build:apk:easy
```

Проверка настроек без сборки:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -DryRun -SkipTypecheck -SkipBackendCheck
```

## Документация

- Полная документация: [DOCUMENTATION.md](DOCUMENTATION.md)
- APK builder: [BUILD_APK.md](BUILD_APK.md)
- Docker stack: [Backend/services-up/README.md](Backend/services-up/README.md)
