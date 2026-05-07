[← Getting Started](getting-started.md) · [Back to README](../README.md) · [API Reference →](api.md)

# Architecture

iCal Sync Proxy построен как небольшой слоистый Fastify-сервис без базы данных. Основная задача — безопасно получить приватный upstream iCal и отдать его клиенту календаря через публичный `.ics` endpoint.

## Слои

| Слой | Файлы | Ответственность |
|------|-------|-----------------|
| Bootstrap | `src/server.ts` | Загрузка env, создание logger, старт Fastify |
| HTTP | `src/http/routes.ts` | Маршруты, HTTP-коды, headers |
| Service | `src/services/calendar-service.ts` | Проверка token, cache TTL, stale fallback |
| Integration | `src/integrations/calendar-source.ts` | Upstream fetch, Basic Auth, timeout, size limit |
| iCal | `src/ical/validate-calendar.ts` | Проверка VCALENDAR payload |
| Observability | `src/observability/logger.ts` | JSON-логи и редактирование секретов |
| Config | `src/config/env.ts` | Чтение defaults и валидация env |

## Поток данных

```text
Client
  |
  v
GET /calendar/:token.ics
  |
  v
HTTP route validates shape and delegates
  |
  v
calendar-service checks PUBLIC_TOKEN and cache TTL
  |
  +--> fresh cache exists: return cached VCALENDAR
  |
  +--> cache miss/stale: fetch upstream with Basic Auth
          |
          v
        validate VCALENDAR and max size
          |
          v
        refresh cache and return text/calendar
```

Если refresh завершается ошибкой, сервис возвращает stale cache, когда предыдущий валидный календарь уже был сохранен. Если кеша нет, клиент получает `502 Bad Gateway`.

## Границы зависимостей

| Модуль | Может зависеть от | Не должен зависеть от |
|--------|-------------------|-----------------------|
| `http` | `services`, типы config/logger | конкретных деталей upstream fetch |
| `services` | `integrations`, `ical`, logger/config types | Fastify request/reply |
| `integrations` | config/logger types, platform `fetch` | HTTP routes |
| `ical` | logger type | Fastify и upstream-клиентов |
| `server.ts` | config, logger, routes | business logic внутри маршрута |

## Cache Model

Кеш хранится в памяти процесса:

| Поле | Смысл |
|------|------|
| `body` | Последний валидный iCal payload |
| `refreshedAtMs` | Время успешного refresh |
| `lastRefreshStatus` | `success`, `failed` или `invalid` |

Последствия:

- рестарт контейнера очищает кеш;
- горизонтальное масштабирование даст отдельный кеш на каждый процесс;
- stale fallback работает только после хотя бы одного успешного refresh.

## Безопасность

- Upstream secrets читаются только из env.
- Неверный `PUBLIC_TOKEN` возвращает `404`, а не `401`.
- Logger редактирует поля с `password`, `token`, `authorization`, `cookie`, `secret`.
- URL в логах очищаются до `origin + pathname`, без query и fragment.
- Upstream response ограничен `MAX_ICAL_BYTES`.

## See Also

- [API Reference](api.md) — контракт маршрутов.
- [Configuration](configuration.md) — env-переменные и валидация.
- [Testing](testing.md) — тесты слоев и ручные проверки.
