# AGENTS.md

> Этот файл поддерживается как краткая карта проекта для AI-агентов. Обновляйте при изменении структуры.

## Обзор проекта
Прокси-сервис для получения календарных данных из защищённого источника и выдачи их в формате iCal (`.ics`). Подробная спецификация хранится в `.ai-factory/DESCRIPTION.md`.

## Технологический стек
- **Язык программирования:** TypeScript (Node.js 20+)
- **Фреймворк:** Fastify
- **База данных:** Не требуется
- **ORM:** Не требуется
- **Тесты:** Vitest
- **Деплой:** Docker Compose + Traefik

## Структура проекта
```text
.
├── .agents/                     # Локально установленные AI Factory skills
├── .codex/                      # Конфигурация/скиллы Codex
├── .ai-factory/                 # Артефакты AI Factory (описание, архитектура, правила)
├── src/
│   ├── config/env.ts            # Загрузка и валидация переменных окружения
│   ├── http/routes.ts           # HTTP-роуты (/health, /calendar/:token.ics)
│   ├── integrations/calendar-source.ts  # Upstream iCal fetch + timeout/size limit
│   ├── ical/validate-calendar.ts        # Валидация VCALENDAR
│   ├── observability/logger.ts          # Структурированный secret-safe logger
│   ├── services/calendar-service.ts     # TTL cache + stale fallback
│   └── server.ts                # Bootstrap Fastify приложения
├── test/                        # Unit/route тесты Vitest
├── docs/                        # Пользовательская документация
├── Dockerfile                   # Production image build/run
├── docker-compose.yml           # Compose + Traefik routing
├── README.md                    # Landing page проекта
├── package.json                 # Node scripts/dependencies
├── tsconfig.json                # TypeScript build config
├── .ai-factory.json             # Реестр установленных skill/MCP для агентов
└── AGENTS.md                    # Карта проекта для агентов
```

## Ключевые точки входа
| Файл | Назначение |
|------|------------|
| `src/server.ts` | Точка запуска сервиса, загрузка env и регистрация роутов |
| `src/http/routes.ts` | HTTP API: `/health`, `/calendar/:token.ics` |
| `src/services/calendar-service.ts` | Бизнес-логика кеша, refresh, stale fallback |
| `src/integrations/calendar-source.ts` | Запрос upstream iCal с Basic Auth |
| `.ai-factory/DESCRIPTION.md` | Описание цели проекта и требований |
| `.ai-factory/ARCHITECTURE.md` | Архитектурные правила и границы модулей |

## Документация
| Документ | Путь | Описание |
|----------|------|----------|
| README | `README.md` | Landing page проекта |
| Getting Started | `docs/getting-started.md` | Установка и первый запуск |
| Architecture | `docs/architecture.md` | Структура и поток данных |
| API Reference | `docs/api.md` | Endpoints и ответы |
| Configuration | `docs/configuration.md` | Env-переменные и defaults |
| Deployment | `docs/deployment.md` | Docker Compose и Traefik |
| Testing | `docs/testing.md` | Сборка и проверки |
| AGENTS | `AGENTS.md` | Карта проекта для агентов |
| Описание проекта | `.ai-factory/DESCRIPTION.md` | Предметная область и цели |
| Архитектура AI Factory | `.ai-factory/ARCHITECTURE.md` | Архитектурные ограничения |
| Базовые правила | `.ai-factory/rules/base.md` | Базовые соглашения |

## AI Context Files
| Файл | Назначение |
|------|------------|
| `AGENTS.md` | Быстрая навигация по проекту |
| `.ai-factory/DESCRIPTION.md` | Источник контекста о продукте |
| `.ai-factory/ARCHITECTURE.md` | Архитектурные ограничения и шаблоны |
| `.ai-factory/config.yaml` | Языковые и workflow-настройки AI Factory |

## Правила для агентов
- Разбивайте составные shell-команды на отдельные шаги.
- Неправильно: `git checkout main && git pull`
- Правильно: сначала `git checkout main`, затем `git pull origin main`.
