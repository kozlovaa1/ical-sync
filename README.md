# iCal Sync Proxy

> Минимальный Fastify-прокси для выдачи защищенного upstream-календаря как iCal (`.ics`).

Сервис скрывает upstream-учетные данные, проверяет публичный токен в URL и отдает календарь в формате `text/calendar`. Он подходит для подписки внешних календарных клиентов на приватный iCal-источник без передачи им upstream-логина и пароля.

## Quick Start

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Перед запуском заполните `.env`: `PUBLIC_TOKEN`, `ICAL_URL`, `ICAL_USERNAME`, `ICAL_PASSWORD`. `PUBLIC_TOKEN` должен быть URL-safe и не короче 32 символов.

## Ключевые возможности

- **Token-gated endpoint** — неверный публичный токен получает `404`.
- **Basic Auth к upstream** — учетные данные остаются только на сервере.
- **iCal validation** — upstream-ответ должен содержать `BEGIN:VCALENDAR` и `END:VCALENDAR`.
- **TTL cache** — свежий кеш отдается без повторного upstream-запроса.
- **Stale fallback** — при ошибке upstream возвращается последний валидный кеш, если он есть.
- **Secret-safe logs** — пароли, токены и Authorization-поля редактируются в логах.

## Пример

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/calendar/wrong-token.ics
curl -i http://127.0.0.1:3000/calendar/YOUR_PUBLIC_TOKEN.ics
```

Ожидаемые ответы:

| Запрос | Ответ |
|--------|------|
| `GET /health` | `200`, `{ "ok": true }` |
| `GET /calendar/wrong-token.ics` | `404`, `{ "message": "Not Found" }` |
| `GET /calendar/YOUR_PUBLIC_TOKEN.ics` | `200`, `Content-Type: text/calendar; charset=utf-8` |

## Публичный endpoint

| Назначение | URL |
|------------|-----|
| Health | `https://ical-sync.ak-net.ru/health` |
| Calendar | `https://ical-sync.ak-net.ru/calendar/<PUBLIC_TOKEN>.ics` |

Весь calendar URL с токеном является секретом. Не публикуйте его и не сохраняйте в открытых логах.

## Документация

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Установка, запуск, первая проверка |
| [Architecture](docs/architecture.md) | Структура, слои, поток данных |
| [API Reference](docs/api.md) | HTTP endpoints и ответы |
| [Configuration](docs/configuration.md) | Переменные окружения и ограничения |
| [Deployment](docs/deployment.md) | Docker Compose и Traefik |
| [Testing](docs/testing.md) | Сборка, тесты, ручные проверки |

## License

Проект приватный (`private: true` в `package.json`); публичная лицензия не указана.
