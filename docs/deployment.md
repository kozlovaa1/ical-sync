[← Configuration](configuration.md) · [Back to README](../README.md) · [Testing →](testing.md)

# Deployment

Production-запуск рассчитан на Docker Compose за Traefik. Контейнер собирает TypeScript в `dist/` и запускает `node dist/server.js`.

## Docker Image

`Dockerfile` использует multi-stage build:

| Stage | Назначение |
|-------|------------|
| `build` | `npm ci`, копирование `src/`, `npm run build` |
| `runtime` | `npm ci --omit=dev`, копирование `dist/`, запуск Node |

Runtime image слушает порт `3000`.

## Compose Service

Основной сервис в `docker-compose.yml`:

| Поле | Значение |
|------|----------|
| `container_name` | `ical-proxy` |
| `env_file` | `.env` |
| `restart` | `unless-stopped` |
| `networks` | `traefik` |
| internal port | `3000` |

Запуск:

```bash
docker compose up -d --build
```

Проверка контейнера:

```bash
docker logs -f ical-proxy
```

В логах не должно быть `PUBLIC_TOKEN`, `ICAL_PASSWORD`, `Authorization` и тела календаря.

## Traefik

Текущий route:

| Label | Значение |
|-------|----------|
| `traefik.enable` | `true` |
| `traefik.http.routers.ical-proxy.rule` | `Host(\`ical-sync.ak-net.ru\`)` |
| `traefik.http.routers.ical-proxy.entrypoints` | `websecure` |
| `traefik.http.routers.ical-proxy.tls` | `true` |
| `traefik.http.services.ical-proxy.loadbalancer.server.port` | `3000` |

Перед запуском проверьте имя внешней Traefik-сети:

```bash
docker network ls
```

Если сеть называется не `traefik_default`, синхронно обновите оба поля в `docker-compose.yml`:

| Поле | Где находится |
|------|---------------|
| `networks.traefik.name` | блок `networks` |
| `traefik.docker.network` | labels сервиса `ical-proxy` |

Эти значения должны указывать на одно и то же имя Docker network.

## Health Check

После деплоя проверьте:

```bash
curl -i https://ical-sync.ak-net.ru/health
curl -i https://ical-sync.ak-net.ru/calendar/wrong-token.ics
```

Ожидаемо:

| Запрос | Результат |
|--------|-----------|
| `/health` | `200`, `{ "ok": true }` |
| wrong token | `404`, `{ "message": "Not Found" }` |

Valid calendar URL проверяйте аккуратно: полный URL содержит секретный `PUBLIC_TOKEN`.

## See Also

- [Configuration](configuration.md) — env-переменные для контейнера.
- [API Reference](api.md) — публичные endpoints.
- [Testing](testing.md) — проверки перед и после деплоя.
