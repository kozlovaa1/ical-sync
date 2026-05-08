[← Deployment](deployment.md) · [Back to README](../README.md)

# Testing

Проект использует TypeScript compiler для build-проверки и Vitest для unit/route тестов.

## Команды

| Команда | Назначение |
|---------|------------|
| `npm run build` | Компиляция TypeScript через `tsc -p tsconfig.json` |
| `npm test` | Однократный запуск Vitest |
| `npm run test:watch` | Watch-режим Vitest |
| `npm run check:compose-ports` | Регресс-проверка: `PORT`/`HOST_PORT` корректно попадают в Compose и Traefik overlay |

## Что покрыто тестами

| Файл | Покрытие |
|------|----------|
| `test/calendar-service.test.ts` | Env validation, logger sanitization, iCal validation, cache TTL, stale fallback |
| `test/routes.test.ts` | `/health`, invalid token `404`, calendar success headers, malformed upstream `502` |

## Ручная проверка

После локального запуска:

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/calendar/wrong-token.ics
curl -i http://127.0.0.1:3000/calendar/YOUR_PUBLIC_TOKEN.ics
```

Проверьте:

| Сценарий | Ожидаемый результат |
|----------|---------------------|
| Health | `200`, `{ "ok": true }` |
| Invalid token | `404`, token не появляется в логах |
| Valid token | `200`, `Content-Type: text/calendar; charset=utf-8` |
| Upstream down после успешного refresh | `200` со stale cache |
| Upstream down без cache | `502 Bad Gateway` |

## Secret Safety Checks

При ручной диагностике не печатайте `.env`. Вместо этого проверяйте косвенные признаки:

- сервер стартует без env validation errors;
- `/calendar/wrong-token.ics` возвращает `404`;
- valid calendar URL возвращает `text/calendar`;
- в `docker logs -f ical-proxy` нет `PUBLIC_TOKEN`, `ICAL_PASSWORD`, `Authorization` и тела календаря.

## Compose Regression Check

Проверка нужна, чтобы не сломать маршрутизацию при нестандартном `PORT`:

```bash
npm run check:compose-ports
```

Скрипт проверяет:
- base compose: `target` следует `PORT`, `published` следует `HOST_PORT`;
- overlay compose: `traefik.http.services.ical-proxy.loadbalancer.server.port` следует `PORT`.

## See Also

- [Getting Started](getting-started.md) — локальный запуск.
- [API Reference](api.md) — HTTP-контракт.
- [Architecture](architecture.md) — cache и stale fallback.
