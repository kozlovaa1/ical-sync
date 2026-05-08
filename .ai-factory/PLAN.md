# Implementation Plan: Универсальный запуск без домена и Traefik

Branch: main
Created: 2026-05-08

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Tasks

### Phase 1: Compose Configuration
- [x] Task 1: Сделать базовый `docker-compose.yml` standalone-конфигурацией без обязательного Traefik.
  - Deliverable: сервис `ical-proxy` запускается через `docker compose up -d --build` и доступен напрямую на host-порту, по умолчанию `3000:3000`; host-порт настраивается отдельной переменной `HOST_PORT`, а `PORT` остается портом приложения внутри контейнера.
  - Files: `docker-compose.yml`, при необходимости `.env.example`.
  - Logging requirements: не менять приложение; сохранить существующий `LOG_LEVEL` из `.env`, в docs указать проверку логов через `docker logs` без вывода секретов.
  - Dependency notes: это базовая конфигурация, от нее зависят docs и проверка compose.

- [x] Task 2: Вынести Traefik-only настройки в отдельный optional compose-файл.
  - Deliverable: добавить `docker-compose.traefik.yml` с explicit подключением сервиса к external Traefik network, labels, router rule и service port, чтобы доменный запуск выполнялся явной командой с двумя compose-файлами.
  - Expected behavior: базовый `docker-compose.yml` не зависит от Traefik-сети; Traefik overlay добавляет network attachment и root-level `networks.traefik`; host rule берется из optional `TRAEFIK_HOST` с примером `ical-sync.ak-net.ru`, а не из обязательного standalone-конфига.
  - Files: `docker-compose.traefik.yml`, при необходимости `.env.example`.
  - Logging requirements: не добавлять чувствительные значения в labels; домен оставить как пример или параметризовать через env без логирования токенов.
  - Dependency notes: зависит от Task 1, чтобы базовый compose не требовал Traefik-сети.

### Phase 2: Documentation
- [x] Task 3: Обновить README с двумя вариантами запуска.
  - Deliverable: Quick Start должен показывать локальный Node.js запуск и Docker standalone запуск без домена; публичный endpoint заменить на шаблон `http://127.0.0.1:3000/...` и отдельно упомянуть Traefik/HTTPS как production-вариант.
  - Files: `README.md`.
  - Logging requirements: в примерах не печатать `.env`, `PUBLIC_TOKEN`, полный calendar URL с реальным токеном или upstream credentials.
  - Dependency notes: зависит от Task 1 и Task 2 для точных команд.

- [x] Task 4: Обновить docs для standalone и Traefik-сценариев.
  - Deliverable: `docs/getting-started.md` описывает Docker-запуск без Traefik; `docs/deployment.md` разделяет standalone Compose и Traefik Compose; `docs/configuration.md` фиксирует `PORT` как внутренний порт приложения, `HOST_PORT` как published host-порт Compose и `TRAEFIK_HOST` как optional production-домен.
  - Files: `docs/getting-started.md`, `docs/deployment.md`, `docs/configuration.md`.
  - Logging requirements: добавить безопасную проверку `docker logs` и предупреждение, что calendar URL с токеном является секретом.
  - Dependency notes: зависит от Task 1 и Task 2.

### Phase 3: Verification
- [x] Task 5: Проверить конфиги и документационные команды.
  - Deliverable: выполнить `docker compose config` для standalone и `docker compose -f docker-compose.yml -f docker-compose.traefik.yml config` для Traefik-варианта с placeholder env values или ограниченным структурным выводом без раскрытия реального `.env`; выполнить `npm test` и `npm run build`, если код приложения не менялся, как регрессионную проверку.
  - Files: нет новых production-файлов сверх compose/docs.
  - Logging requirements: при ручной проверке endpoint использовать placeholder token или wrong-token; не выводить реальные значения из `.env`, rendered secrets из `docker compose config`, полный calendar URL с настоящим token или upstream credentials.
  - Dependency notes: финальная проверка после Tasks 1-4.

## Commit Plan
- **Commit 1** (after tasks 1-2): `chore: split standalone and traefik compose configs`
- **Commit 2** (after tasks 3-5): `docs: document standalone and traefik launch modes`
