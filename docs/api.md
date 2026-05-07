[← Architecture](architecture.md) · [Back to README](../README.md) · [Configuration →](configuration.md)

# API Reference

Сервис предоставляет два HTTP endpoints: health-check и выдачу iCal-календаря.

## Base URL

| Окружение | URL |
|-----------|-----|
| Локально | `http://127.0.0.1:3000` |
| Production | `https://ical-sync.ak-net.ru` |

Production host задается Traefik rule в `docker-compose.yml`.

## Authentication

Calendar endpoint использует публичный token как часть URL:

```text
/calendar/:token.ics
```

Token сравнивается с `PUBLIC_TOKEN`. При несовпадении сервис возвращает `404`, чтобы не раскрывать наличие защищенного календаря.

## GET /health

Проверяет, что HTTP-сервис отвечает.

```bash
curl -i http://127.0.0.1:3000/health
```

Ответ:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
```

```json
{ "ok": true }
```

## GET /calendar/:token.ics

Возвращает валидный iCal payload из свежего кеша, нового upstream-запроса или stale cache.

```bash
curl -i http://127.0.0.1:3000/calendar/YOUR_PUBLIC_TOKEN.ics
```

Успешный ответ:

```http
HTTP/1.1 200 OK
Content-Type: text/calendar; charset=utf-8
Cache-Control: public, max-age=300
```

```text
BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR
```

`max-age` равен `CACHE_TTL_SECONDS`.

## Error Responses

| Статус | Тело | Когда возникает |
|--------|------|-----------------|
| `404` | `{ "message": "Not Found" }` | `token` не совпадает с `PUBLIC_TOKEN` |
| `502` | `{ "message": "Bad Gateway" }` | Upstream недоступен, timeout, превышен size limit или payload невалиден, а stale cache отсутствует |

Если stale cache существует, ошибки upstream не видны клиенту как `502`: сервис возвращает `200` с последним валидным календарем.

## Headers

| Header | Значение |
|--------|----------|
| `Content-Type` | `text/calendar; charset=utf-8` для calendar endpoint |
| `Cache-Control` | `public, max-age=<CACHE_TTL_SECONDS>` |

## See Also

- [Getting Started](getting-started.md) — локальные curl-проверки.
- [Configuration](configuration.md) — `PUBLIC_TOKEN`, TTL и limits.
- [Architecture](architecture.md) — поток обработки запроса.
