[← API Reference](api.md) · [Back to README](../README.md) · [Deployment →](deployment.md)

# Configuration

Конфигурация читается из переменных окружения. Для локального запуска используйте `.env`, созданный из `.env.example`.

## Environment Variables

| Переменная | Обязательная | Default | Ограничения | Назначение |
|------------|--------------|---------|-------------|------------|
| `PORT` | Нет | `3000` | integer `>= 1` | Внутренний HTTP-порт приложения (в контейнере и локальном Node.js запуске) |
| `HOST_PORT` | Нет | `3000` | integer `>= 1` | Host-порт публикации в `docker-compose.yml` (`HOST_PORT:PORT`) |
| `TRAEFIK_HOST` | Нет | `ical-sync.ak-net.ru` | валидный DNS host | Опциональный домен для Traefik overlay (`docker-compose.traefik.yml`) |
| `LOG_LEVEL` | Нет | `info` | `debug`, `info`, `warn`, `error`; неизвестное значение становится `info` | Уровень JSON-логов |
| `PUBLIC_TOKEN` | Да | - | минимум 32 символа; только `A-Z`, `a-z`, `0-9`, `_`, `-` | Token в calendar URL |
| `ICAL_URL` | Да | - | валидный абсолютный URL | Upstream iCal endpoint |
| `ICAL_USERNAME` | Да | - | непустая строка | Username для Basic Auth |
| `ICAL_PASSWORD` | Да | - | непустая строка | Password для Basic Auth |
| `CACHE_TTL_SECONDS` | Нет | `300` | integer `>= 1` | TTL свежего in-memory cache |
| `REQUEST_TIMEOUT_MS` | Нет | `15000` | integer `>= 100` | Timeout upstream-запроса |
| `MAX_ICAL_BYTES` | Нет | `5242880` | integer `>= 1024` | Максимальный размер upstream iCal |

## Token Rules

`PUBLIC_TOKEN` используется внутри path segment:

```text
/calendar/<PUBLIC_TOKEN>.ics
```

Поэтому token должен быть URL-safe. Не используйте `/`, `?`, `#`, пробелы и символы, требующие URL escaping.

## Upstream Auth

`ICAL_USERNAME` и `ICAL_PASSWORD` отправляются в upstream как HTTP Basic Auth:

```text
Authorization: Basic base64(username:password)
```

Этот header не возвращается клиенту и не должен появляться в логах.

## Logging

Logger пишет JSON-строки и редактирует чувствительные поля по имени ключа:

| Паттерн ключа | Пример |
|---------------|--------|
| `pass`, `password` | `ICAL_PASSWORD` |
| `token` | `PUBLIC_TOKEN` |
| `authorization` | HTTP Authorization |
| `cookie`, `set-cookie` | Cookie headers |
| `secret`, `apikey`, `api-key` | API secrets |

URL-поля очищаются до `origin + pathname`; query string и fragment не логируются.

Для Docker-проверки используйте безопасный просмотр логов:

```bash
docker logs -f ical-proxy
```

Не выводите в публичные каналы полный calendar URL c `PUBLIC_TOKEN`.

## Validation Failures

При ошибках env-валидации сервер не стартует и пишет безопасный список проблем:

| Code | Когда возникает |
|------|-----------------|
| `missing` | обязательная переменная пустая или отсутствует |
| `invalid_number` | числовая переменная не integer или ниже минимума |
| `too_short` | `PUBLIC_TOKEN` короче 32 символов |
| `invalid_token_format` | `PUBLIC_TOKEN` содержит не URL-safe символы |
| `invalid_url` | `ICAL_URL` не является абсолютным URL |

## See Also

- [Getting Started](getting-started.md) — создание `.env`.
- [API Reference](api.md) — как `PUBLIC_TOKEN` используется в URL.
- [Deployment](deployment.md) — env-файл в Docker Compose.
