# PocketLib APK builder

## Вариант без Expo аккаунта

Основная команда:

```powershell
npm run build:apk:easy
```

Она запускает локальную Android/Gradle сборку через `scripts/build-apk-local.ps1`.
Expo account для этого режима не нужен.

Эти команды делают то же самое:

```powershell
npm run build:apk
npm run build:apk:local
npm run build:apk:offline
```

Готовый APK будет скопирован в:

```text
dist/apk/
```

Проверить команды без реальной сборки:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-apk-local.ps1 -DryRun -SkipTypecheck -SkipBackendCheck
```

## Требования для локальной сборки

Нужно установить:

- Android Studio;
- Android SDK;
- JDK 17;
- переменную `ANDROID_HOME` или `ANDROID_SDK_ROOT`.

Обычно Android Studio сама ставит SDK. После установки открой новое окно PowerShell.

Проверка:

```powershell
java -version
echo $env:ANDROID_HOME
echo $env:ANDROID_SDK_ROOT
```

## Если backend на другом адресе

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-apk-local.ps1 -ApiUrl "http://192.168.1.10:8080"
```

Для APK на реальном телефоне нельзя использовать `localhost`: телефон будет искать сервер внутри себя. Нужен IP компьютера или реального сервера.

Для EAS APK то же самое:

```powershell
npm run build:apk:eas -- -ApiUrl "http://192.168.1.10:8080"
```

`scripts/build-apk.ps1` записывает этот адрес в `eas.json` как `EXPO_PUBLIC_API_URL`, чтобы облачная сборка Expo реально вшила backend URL в APK.

Если APK уже установлен и backend адрес поменялся, открой экран входа, нажми `Сервер backend`, укажи новый URL и проверь соединение. Это сохраняется на устройстве без пересборки APK.

Важно: телефон должен видеть backend по сети. Если backend запущен на ноутбуке, телефон и ноутбук должны быть в одной Wi-Fi сети, а Windows Firewall должен пропускать порт `8080`.

## Запуск всей системы для разработки

```powershell
npm run dev:pocketlib
```

Команда поднимает backend через Docker Compose, ждёт `/health`, выставляет `EXPO_PUBLIC_API_URL` и запускает Expo в LAN-режиме.

## Вариант через Expo/EAS

EAS build - это облачная сборка Expo. Она требует Expo аккаунт.

Если хочешь использовать EAS:

```powershell
npx eas-cli@latest login
npm run eas:init
npm run build:apk:eas
```

Или можно задать `EXPO_TOKEN`, если сборка идет на CI.

`npm run eas:init` нужно выполнить один раз. Эта команда привязывает локальный проект к Expo/EAS и записывает `extra.eas.projectId` в `app.json`.

Если после создания проекта появилось:

```text
Cannot read properties of undefined (reading 'projectId')
```

проверь `app.json`. Если там появился `expo.extra.eas.projectId`, и команда ниже показывает ID проекта, можно просто продолжать сборку:

```powershell
npx eas-cli@latest project:info
npm run build:apk:eas
```

Ошибка:

```text
An Expo user account is required to proceed.
```

означает, что ты запустил EAS cloud build без входа в Expo аккаунт. Для сборки без аккаунта используй:

```powershell
npm run build:apk:easy
```

Ошибка:

```text
EAS project not configured.
```

означает, что аккаунт уже есть, но проект еще не привязан к EAS. Выполни:

```powershell
npm run eas:init
npm run build:apk:eas
```

## Production AAB

Для Google Play обычно нужен `.aab`. Это уже удобнее делать через EAS:

```powershell
npx eas-cli@latest login
npm run build:aab
```
