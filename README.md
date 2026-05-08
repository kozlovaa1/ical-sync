# iCal Sync Proxy
[![CI](https://github.com/kozlovaa1/ical-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/kozlovaa1/ical-sync/actions/workflows/ci.yml)

> Минимальный Fastify-прокси для выдачи защищенного upstream-календаря как iCal (`.ics`).

Сервис скрывает upstream-учетные данные, проверяет публичный токен в URL и отдает календарь в формате `text/calendar`. Он подходит для подписки внешних календарных клиентов на приватный iCal-источник без передачи им upstream-логина и пароля.

## Quick Start

### Node.js (local)

Требуется `Node.js 22 LTS` или более новый LTS runtime (`package.json` задает минимальную версию `>=22`).

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Перед запуском заполните `.env`: `PUBLIC_TOKEN`, `ICAL_URL`, `ICAL_USERNAME`, `ICAL_PASSWORD`. `PUBLIC_TOKEN` должен быть URL-safe и не короче 32 символов.

### Docker Compose (standalone, без Traefik)

```bash
cp .env.example .env
docker compose up -d --build
docker logs -f ical-proxy
```

По умолчанию сервис доступен на `http://127.0.0.1:3000`. Для публикации на другом порту задайте `HOST_PORT` в `.env`. `PORT` остается внутренним портом приложения внутри контейнера.

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

## Endpoint examples

| Назначение | URL |
|------------|-----|
| Health | `http://127.0.0.1:3000/health` |
| Calendar | `http://127.0.0.1:3000/calendar/<PUBLIC_TOKEN>.ics` |

Весь calendar URL с токеном является секретом. Не публикуйте его и не сохраняйте в открытых логах.

Для production с HTTPS и доменом используйте Traefik overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

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

MIT — см. [LICENSE](LICENSE).
