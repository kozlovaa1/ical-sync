[← Configuration](configuration.md) · [Back to README](../README.md) · [Testing →](testing.md)

# Deployment

Контейнер собирает TypeScript в `dist/` и запускает `node dist/server.js` в runtime `Node.js 22 LTS`. Возможны два режима: standalone (без Traefik) и production overlay с Traefik.

## Docker Image

`Dockerfile` использует multi-stage build:

| Stage | Назначение |
|-------|------------|
| `build` | `node:22-alpine`, `npm ci`, копирование `src/`, `npm run build` |
| `runtime` | `node:22-alpine`, `npm ci --omit=dev`, копирование `dist/`, запуск Node |

Runtime image слушает порт `3000`.

## Standalone Compose (без Traefik)

Базовый сервис в `docker-compose.yml`:

| Поле | Значение |
|------|----------|
| `container_name` | `ical-proxy` |
| `env_file` | `.env` |
| `restart` | `unless-stopped` |
| `ports` | `${HOST_PORT:-3000}:${PORT:-3000}` |
| internal port | `${PORT:-3000}` |

Запуск:

```bash
docker compose up -d --build
```

Проверка контейнера:

```bash
docker logs -f ical-proxy
```

В логах не должно быть `PUBLIC_TOKEN`, `ICAL_PASSWORD`, `Authorization` и тела календаря.

## Traefik Overlay (optional)

Traefik-настройки вынесены в `docker-compose.traefik.yml` и подключаются вторым файлом:

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

Параметры роутинга:

| Label | Значение |
|-------|----------|
| `traefik.enable` | `true` |
| `traefik.http.routers.ical-proxy.rule` | `Host(\`${TRAEFIK_HOST}\`)` |
| `traefik.http.routers.ical-proxy.entrypoints` | `websecure` |
| `traefik.http.routers.ical-proxy.tls` | `true` |
| `traefik.http.routers.ical-proxy.tls.certresolver` | `${TRAEFIK_CERTRESOLVER:-le}` |
| `traefik.http.services.ical-proxy.loadbalancer.server.port` | `${PORT:-3000}` |

Перед запуском проверьте имя внешней Traefik-сети:

```bash
docker network ls
```

Если сеть называется не `traefik_default`, синхронно обновите оба поля в `docker-compose.traefik.yml`:

| Поле | Где находится |
|------|---------------|
| `networks.traefik.name` | блок `networks` |
| `traefik.docker.network` | labels сервиса `ical-proxy` |

Эти значения должны указывать на одно и то же имя Docker network.

## Health Check

После деплоя проверьте:

```bash
curl -i http://127.0.0.1:${HOST_PORT:-3000}/health
curl -i http://127.0.0.1:${HOST_PORT:-3000}/calendar/wrong-token.ics
```

Ожидаемо:

| Запрос | Результат |
|--------|-----------|
| `/health` | `200`, `{ "ok": true }` |
| wrong token | `404`, `{ "message": "Not Found" }` |

Valid calendar URL проверяйте аккуратно: полный URL содержит секретный `PUBLIC_TOKEN`.
Для production через Traefik используйте тот же путь `/calendar/<PUBLIC_TOKEN>.ics` на вашем `TRAEFIK_HOST`.

## See Also

- [Configuration](configuration.md) — env-переменные для контейнера.
- [API Reference](api.md) — публичные endpoints.
- [Testing](testing.md) — проверки перед и после деплоя.
