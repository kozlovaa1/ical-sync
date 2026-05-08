# Implementation Plan: Миграция рантайма проекта на Node.js 22 LTS

Branch: main
Created: 2026-05-08

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Tasks

### Phase 1: Runtime Baseline Alignment
- [x] Task 1: Привести все декларации поддерживаемой версии Node.js к `22 LTS`.
  - Deliverable: единый runtime baseline `Node.js 22 LTS` во всех user-facing и tooling-конфигурациях.
  - Expected behavior: отсутствуют конфликтующие указания `Node 20+`; `engines.node` и root metadata в lockfile задают минимум Node 22 без запрета будущих LTS версий и без dependency churn, если обновление пакетов не требуется.
  - Files: `package.json`, `package-lock.json`, `src/server.ts`, возможные runtime-файлы (`.nvmrc`, `.node-version`) при наличии.
  - Logging requirements: добавить/сохранить INFO-лог старта с `nodeVersion: process.version` в безопасном startup payload; не логировать env/secrets.
  - Dependency notes: базовый шаг для последующих тестов и документации.

### Phase 2: Dependency and Toolchain Compatibility Check
- [x] Task 2: Проверить совместимость зависимостей и dev-toolchain с Node 22.
  - Deliverable: подтверждено, что Fastify/Vitest/TypeScript/tsx корректно работают под Node 22; при необходимости — минимальные безопасные апдейты зависимостей.
  - Expected behavior: `npm install`, `npm run build`, `npm test` проходят под Node 22 без регрессий.
  - Files: `package.json`, `package-lock.json` (только если действительно нужны апдейты).
  - Logging requirements: при падениях добавить DEBUG-детализацию причин несовместимости (package/script/stack) без чувствительных данных.
  - Dependency notes: зависит от Task 1.

### Phase 3: CI/CD and Container Runtime Update
- [x] Task 3: Обновить CI и контейнерные пайплайны на Node 22 как единственный целевой runtime.
  - Deliverable: workflows и контейнерная сборка используют Node 22; матрицы/кэши и команды сборки согласованы.
  - Expected behavior: `.github/workflows/ci.yml` использует `node-version: '22'`; CI не запускается на устаревшем runtime; Docker build/run консистентны с локальным baseline.
  - Files: `.github/workflows/ci.yml` (и related workflows), `Dockerfile`, при необходимости `docker-compose*.yml`.
  - Logging requirements: в CI сохранять стандартные build/test логи и безопасный шаг версий runtime (`node -v`, `npm -v`), не печатать секреты.
  - Dependency notes: зависит от Task 2.

### Phase 4: Documentation Synchronization
- [x] Task 4: Актуализировать документацию проекта под Node 22 LTS.
  - Deliverable: Quick Start, getting started и testing/deployment разделы отражают Node 22 и обновленные команды проверки.
  - Expected behavior: у пользователя и будущих AI-агентов нет расхождений между README/docs/context-файлами и фактическим runtime; старые формулировки `Node.js 20+` и `>=20` заменены на Node 22 LTS или более новый LTS runtime.
  - Files: `README.md`, `docs/getting-started.md`, `docs/testing.md`, `docs/deployment.md`, `docs/configuration.md`, `.ai-factory/DESCRIPTION.md`, `AGENTS.md` (по необходимости).
  - Logging requirements: примеры логов и команд без вывода секретов (`PUBLIC_TOKEN`, upstream credentials, full protected URL).
  - Dependency notes: зависит от Task 3.

### Phase 5: Verification and Rollout Safety
- [x] Task 5: Провести финальную верификацию миграции и зафиксировать критерии отката.
  - Deliverable: подтверждены build/test/health-check именно в Node 22 execution context; описан rollback path на случай runtime regression.
  - Expected behavior: `node -v` показывает Node 22+ LTS в среде проверки; `npm run build`, `npm test`, `GET /health`, и smoke-check `GET /calendar/wrong-token.ics` проходят ожидаемо. Если локальная shell-среда не Node 22+ LTS, выполнять runtime verification через Node 22 Docker image/контейнер и отдельно отметить это в результатах.
  - Files: без новых production-файлов; при необходимости — небольшой раздел в docs/changelog.
  - Logging requirements: верификационные логи включают статусы шагов и версии runtime, без токенов и приватных URL.
  - Dependency notes: финальный шаг после Tasks 1-4.

## Commit Plan
- **Commit 1** (after tasks 1-2): `chore(runtime): migrate project baseline to node 22 lts`
- **Commit 2** (after tasks 3-4): `chore(ci): align pipelines and docs with node 22`
- **Commit 3** (after task 5): `test: verify node 22 migration and rollout safety checks`
