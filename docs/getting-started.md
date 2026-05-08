[Back to README](../README.md) · [Architecture →](architecture.md)

# Getting Started

Эта страница описывает локальный запуск iCal Sync Proxy и минимальные проверки после старта.

## Prerequisites

| Инструмент | Требование |
|------------|------------|
| Node.js | `>=20` по `package.json` |
| npm | Версия, совместимая с `package-lock.json` |
| curl | Для ручной проверки HTTP endpoints |

Для контейнерного запуска нужен Docker + Docker Compose. Traefik нужен только для production-домена/HTTPS-режима. Подробности: [Deployment](deployment.md).

## Установка

```bash
cp .env.example .env
npm install
```

Заполните `.env` перед запуском. Не выводите содержимое `.env` в логи, issue или публичные чаты.

Минимально обязательные значения:

| Переменная | Назначение |
|------------|------------|
| `PUBLIC_TOKEN` | Публичный токен в calendar URL |
| `ICAL_URL` | Абсолютный URL upstream iCal |
| `ICAL_USERNAME` | Логин для upstream Basic Auth |
| `ICAL_PASSWORD` | Пароль для upstream Basic Auth |

## Локальный запуск

```bash
npm run build
npm start
```

По умолчанию сервис слушает `0.0.0.0:3000`. Порт меняется через `PORT`.

Для разработки доступен watch-режим:

```bash
npm run dev
```

## Docker (standalone)

```bash
cp .env.example .env
docker compose up -d --build
docker logs -f ical-proxy
```

По умолчанию standalone-публикация: `http://127.0.0.1:3000`. В `.env`:
- `PORT` — внутренний порт приложения в контейнере
- `HOST_PORT` — опубликованный host-порт Docker Compose

## Проверка

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/calendar/wrong-token.ics
curl -i http://127.0.0.1:3000/calendar/YOUR_PUBLIC_TOKEN.ics
```

Ожидаемо:

| Проверка | Результат |
|----------|-----------|
| `/health` | `200`, `{ "ok": true }` |
| Неверный token | `404`, `{ "message": "Not Found" }` |
| Верный token | `200`, `text/calendar; charset=utf-8` |

Если верный token возвращает `502`, проверьте доступность `ICAL_URL`, upstream-учетные данные и валидность iCal payload.

## Google Calendar

1. Откройте Google Calendar.
2. Выберите «Другие календари» → «Добавить по URL».
3. Вставьте `http://127.0.0.1:3000/calendar/<PUBLIC_TOKEN>.ics` (или ваш production HTTPS URL за Traefik).
4. Сохраните подписку.

Google Calendar обновляет внешние iCal-подписки с задержкой; изменение upstream-календаря обычно не появляется мгновенно.

Полный calendar URL с `<PUBLIC_TOKEN>` считается секретом — не публикуйте его в логах, скриншотах и публичных каналах.

## See Also

- [Configuration](configuration.md) — все env-переменные и defaults.
- [API Reference](api.md) — HTTP endpoints и статусы.
- [Deployment](deployment.md) — production-запуск через Docker Compose.
