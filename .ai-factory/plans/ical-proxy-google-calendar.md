# Implementation Plan: iCal Proxy for Google Calendar

Branch: main (no feature branch created: repository has no commits and current files are untracked)
Created: 2026-05-07
Target project directory: `/srv/projects/ical-sync`
Plan source workspace: `/srv/projects/ical-sync`

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes
- Roadmap linkage: not applicable; `.ai-factory/ROADMAP.md` does not exist

## Assumptions
- Implement the service directly in the current project directory `/srv/projects/ical-sync`.
- Do not create, print, rewrite, or commit a real `.env`; only create `.env.example`.
- Use TypeScript + Fastify because the requested service is small but benefits from typed configuration and endpoint contracts.
- Use Node.js built-in `fetch`, `AbortController`, and streams where practical; add only minimal runtime dependencies.
- Return `404 Not Found` for invalid token to avoid confirming endpoint existence.
- Treat the public URL containing `PUBLIC_TOKEN` as a secret in docs and logs.
- The DNS/subdomain record `ical-sync.ak-net.ru` is already available on the current server; configure Traefik HTTPS routing for this host.
- Before deployment, verify the real Traefik external Docker network name with `docker network ls` and update `docker-compose.yml` if it is not `traefik`.

## Architecture Context
The current architecture guidance requires layered boundaries:
- HTTP layer handles routes, status codes, headers, and request context.
- Service layer orchestrates token validation, cache lookup, upstream fetch, stale fallback, and response classification.
- Integration layer performs the authenticated upstream iCal request and enforces timeout/size limits.
- Config and observability are separated from HTTP and integration code.

## Target File Structure
```text
/srv/projects/ical-sync
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── http/
│   │   └── routes.ts
│   ├── integrations/
│   │   └── calendar-source.ts
│   ├── ical/
│   │   └── validate-calendar.ts
│   ├── observability/
│   │   └── logger.ts
│   ├── services/
│   │   └── calendar-service.ts
│   └── server.ts
├── test/
│   ├── calendar-service.test.ts
│   └── routes.test.ts
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## Commit Plan
- **Commit 1** (after tasks 1-4): `chore: scaffold ical proxy service`
- **Commit 2** (after tasks 5-8): `feat: implement authenticated calendar proxy`
- **Commit 3** (after tasks 9-11): `test: cover calendar proxy behavior`
- **Commit 4** (after tasks 12-13): `docs: add docker deployment guide`

## Tasks

### Phase 0: Boundary and Safety Preflight
- [x] Task 1: Confirm current workspace state and secret safety.
  Deliverable: verified current workspace state before adding application files to `/srv/projects/ical-sync`.
  Expected behavior: inspect git status; preserve existing `.ai-factory`, `.agents`, `.codex`, and `AGENTS.md` artifacts; do not read, print, modify, or create a real `/srv/projects/ical-sync/.env` without explicit operator confirmation.
  Files: no required file changes.
  Logging requirements: no runtime logging; command output must not expose secret-bearing files.
  Dependency notes: first task; all file-creation tasks depend on this preflight.

### Phase 1: Project Scaffold
- [x] Task 2: Create project directory and package metadata.
  Deliverable: `/srv/projects/ical-sync/package.json`, `/srv/projects/ical-sync/tsconfig.json`, and initial `src/` tree exist with TypeScript build scripts.
  Expected behavior: `npm install` and `npm run build` can run once implementation files are added.
  Files: `/srv/projects/ical-sync/package.json`, `/srv/projects/ical-sync/tsconfig.json`, `/srv/projects/ical-sync/src/`
  Logging requirements: define `LOG_LEVEL` support in package/config expectations; no runtime logging is required in this scaffold task beyond documenting that application logs must be environment-controlled.
  Dependency notes: depends on Task 1; all implementation tasks depend on this scaffold.

- [x] Task 3: Add safe configuration loading and validation.
  Deliverable: typed environment config with required variables, defaults, and validation failures at startup.
  Expected behavior: validate `PORT`, `PUBLIC_TOKEN`, `ICAL_URL`, `ICAL_USERNAME`, `ICAL_PASSWORD`, `CACHE_TTL_SECONDS`, `REQUEST_TIMEOUT_MS`, and optional `MAX_ICAL_BYTES`; reject `PUBLIC_TOKEN` shorter than 32 characters; never print secret values; return sanitized validation metadata/errors that startup code can log after the logger is initialized.
  Files: `/srv/projects/ical-sync/src/config/env.ts`, `/srv/projects/ical-sync/.env.example`, `/srv/projects/ical-sync/.gitignore`
  Logging requirements: config code must expose only sanitized metadata; startup logging should later log validation success at `INFO` and missing/invalid variable names at `ERROR`; never log `ICAL_PASSWORD`, `PUBLIC_TOKEN`, Authorization headers, or full `ICAL_URL`.
  Dependency notes: depends on Task 2; Task 4 defines the logger used by startup.

- [x] Task 4: Add structured logger utility with secret-safe conventions.
  Deliverable: a small logger abstraction used by routes, service, integration, and startup.
  Expected behavior: support `debug`, `info`, `warn`, `error`; honor `LOG_LEVEL`; include request IDs where provided; sanitize URLs to origin + pathname only and omit query strings.
  Files: `/srv/projects/ical-sync/src/observability/logger.ts`
  Logging requirements: this task defines logging behavior; include safeguards against accidental secret exposure and document expected levels in code comments where useful.
  Dependency notes: depends on Task 2; Task 3 startup integration should use it after both are available.

### Phase 2: Core Proxy Behavior
- [x] Task 5: Implement upstream iCal fetch integration with Basic Auth, timeout, and size limit.
  Deliverable: calendar source client that downloads `.ics` from `ICAL_URL` using `ICAL_USERNAME` and `ICAL_PASSWORD` via Basic Auth.
  Expected behavior: enforce `REQUEST_TIMEOUT_MS`; reject non-2xx upstream responses; limit response body to 5-10 MB via `MAX_ICAL_BYTES` default; return body as UTF-8 string; surface typed errors for timeout, size limit, upstream status, and network failure.
  Files: `/srv/projects/ical-sync/src/integrations/calendar-source.ts`
  Logging requirements: log upstream request start and completion at `DEBUG` with sanitized URL and latency; log upstream non-2xx, timeout, size-limit, and network failures at `WARN` or `ERROR` without credentials or query strings.
  Dependency notes: depends on Tasks 3 and 4.

- [x] Task 6: Add iCal validation and presentation boundary.
  Deliverable: a small `ical` module that validates upstream calendar bodies before they are cached or returned.
  Expected behavior: accept valid UTF-8 iCal content that contains `BEGIN:VCALENDAR` and `END:VCALENDAR`; reject empty, oversized-after-decode, or malformed calendar text with a typed invalid-calendar error; do not transform secrets or log calendar body contents.
  Files: `/srv/projects/ical-sync/src/ical/validate-calendar.ts`
  Logging requirements: log invalid upstream calendar classification at `WARN` with size and source classification only; never log calendar body.
  Dependency notes: depends on Tasks 3, 4, and 5; Task 7 depends on this validation result.

- [x] Task 7: Implement in-memory calendar cache service with stale fallback.
  Deliverable: service function that validates token, decides fresh-cache vs fetch, updates cache, and returns response state.
  Expected behavior: fresh cache returns without upstream call; expired cache triggers refresh; refresh failure or invalid upstream iCal with stale cache returns stale data and logs warning; refresh failure or invalid upstream iCal without cache returns `502`; cache stores validated body, last successful refresh time, and last refresh status.
  Files: `/srv/projects/ical-sync/src/services/calendar-service.ts`
  Logging requirements: log cache hit/miss/stale decisions at `DEBUG`; log successful refresh at `INFO` with age/size only; log stale fallback at `WARN`; log final failure without cache at `ERROR`; never log token or calendar body.
  Dependency notes: depends on Tasks 3, 4, 5, and 6.

- [x] Task 8: Implement Fastify server and routes.
  Deliverable: `GET /health` and `GET /calendar/:token.ics` endpoints.
  Expected behavior: `/health` returns `{ "ok": true }`; invalid token returns `404`; valid token returns `Content-Type: text/calendar; charset=utf-8` and `Cache-Control: public, max-age=<CACHE_TTL_SECONDS>`; upstream failure without cache returns `502 Bad Gateway` with safe message.
  Files: `/srv/projects/ical-sync/src/server.ts`, `/srv/projects/ical-sync/src/http/routes.ts`
  Logging requirements: log server startup and bind address at `INFO`; log incoming calendar request with request ID and endpoint only at `DEBUG`; log invalid token attempt at `WARN` without token value; log response classification and status at `INFO` or `DEBUG`.
  Dependency notes: depends on Tasks 3, 4, and 7.

### Phase 3: Tests and Verification Scripts
- [x] Task 9: Add unit tests for configuration, iCal validation, and cache/service behavior.
  Deliverable: automated tests covering token length validation, invalid token handling, valid iCal validation, malformed upstream iCal handling, fresh cache hit, expired cache refresh, stale fallback, and `502` when no cache exists.
  Expected behavior: tests run through `npm test`; mocks avoid real network and secrets.
  Files: `/srv/projects/ical-sync/test/calendar-service.test.ts`, `/srv/projects/ical-sync/package.json`
  Logging requirements: test logger should be silenced or captured; assert no logs include token/password/calendar body when testing error paths.
  Dependency notes: depends on Tasks 3, 6, and 7.

- [x] Task 10: Add route tests for HTTP contract.
  Deliverable: Fastify injection tests for `/health`, invalid token, valid token success, and upstream failure response mapping.
  Expected behavior: valid calendar response starts with `BEGIN:VCALENDAR` in mocked body; invalid token returns `404`; malformed upstream iCal maps to safe `502` when no stale cache exists; content type and cache headers are correct.
  Files: `/srv/projects/ical-sync/test/routes.test.ts`, `/srv/projects/ical-sync/src/http/routes.ts`
  Logging requirements: route tests should verify invalid token logging does not include the submitted token value.
  Dependency notes: depends on Task 8.

- [x] Task 11: Run local Node verification.
  Deliverable: dependency installation and successful build/test results.
  Expected behavior: run `npm install`, `npm run build`, and `npm test`; run `npm run lint` only if lint is configured. If lint is not configured, document that it was intentionally skipped per requirement.
  Files: `/srv/projects/ical-sync/package-lock.json` if generated by `npm install`
  Logging requirements: capture only relevant command failures; do not print `.env` contents or secret-bearing command lines.
  Dependency notes: depends on Tasks 1-10.

### Phase 4: Docker, Traefik, and Documentation
- [x] Task 12: Add Docker image and Compose deployment.
  Deliverable: production Dockerfile and `docker-compose.yml` with Traefik labels.
  Expected behavior: Docker image builds TypeScript and starts `node dist/server.js`; service listens on port `3000`; Compose uses `env_file: .env`, `restart: unless-stopped`, container name `ical-proxy`, and Traefik HTTPS labels/router rule for `ical-sync.ak-net.ru`.
  Files: `/srv/projects/ical-sync/Dockerfile`, `/srv/projects/ical-sync/docker-compose.yml`
  Logging requirements: container startup logs sanitized config status and listen port only; Docker/Compose files must not embed secrets.
  Dependency notes: depends on Tasks 2 and 8; before final deployment, verify Traefik network name with `docker network ls` and adjust `networks.traefik.name` or external network key if needed; DNS for `ical-sync.ak-net.ru` is already available on this server and should not require a separate DNS task.

- [x] Task 13: Write README with setup, secret handling, and Google Calendar usage.
  Deliverable: `/srv/projects/ical-sync/README.md` documents purpose, `.env` creation, token generation, Docker startup, health check, iCal endpoint check, Google Calendar URL, logs, caching behavior, stale fallback, and Google Calendar refresh delay caveat.
  Expected behavior: README explicitly states that the URL with token is secret and must not be shared or logged.
  Files: `/srv/projects/ical-sync/README.md`
  Logging requirements: documentation must instruct operators not to paste secrets into issue reports/logs and to inspect logs with `docker logs -f ical-proxy`.
  Dependency notes: depends on Tasks 3, 8, and 12.

### Phase 5: Deployment Validation
- [x] Task 14: Build and run the container through Docker Compose.
  Deliverable: service runs in Docker on the production server.
  Expected behavior: run `docker compose up -d --build`; inspect `docker logs -f ical-proxy` only for startup and request diagnostics; do not print `.env`.
  Files: `/srv/projects/ical-sync/docker-compose.yml`, `/srv/projects/ical-sync/.env` (operator-provided, not committed)
  Logging requirements: verify logs show startup and sanitized config only; no `ICAL_PASSWORD`, `PUBLIC_TOKEN`, Authorization header, full secret-bearing upstream URL, or calendar body.
  Dependency notes: depends on Tasks 11-13 and requires a real `.env` provided by the operator.

- [x] Task 15: Verify HTTPS endpoints through Traefik.
  Deliverable: externally reachable service at `https://ical-sync.ak-net.ru`.
  Expected behavior: `curl -i https://ical-sync.ak-net.ru/health` returns success; `curl -i https://ical-sync.ak-net.ru/calendar/wrong-token.ics` returns `404`; `curl -i https://ical-sync.ak-net.ru/calendar/YOUR_TOKEN.ics` returns `200`, `Content-Type: text/calendar; charset=utf-8`, and body starting near `BEGIN:VCALENDAR`.
  Files: no file changes expected unless Traefik network or labels need correction in `/srv/projects/ical-sync/docker-compose.yml`
  Logging requirements: log validation requests with request ID and status only; do not include the real token in command transcripts, shell history notes, or logs.
  Dependency notes: depends on Task 14 and Traefik TLS routing for the already available host `ical-sync.ak-net.ru`.

## Security Gates
- `.env` is ignored and never committed.
- `PUBLIC_TOKEN` validation enforces at least 32 characters.
- Invalid token returns `404` and never calls upstream.
- Logs never include `ICAL_PASSWORD`, `PUBLIC_TOKEN`, Authorization header, full secret-bearing URL, calendar body, or query strings.
- Upstream response size is capped to prevent memory exhaustion.
- Upstream calendar content is validated before cache update or HTTP response.
- Outbound request has timeout and typed failure handling.
- Docker and Compose files contain no secrets.

## Verification Checklist
- [x] `npm install`
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run lint` only if configured
- [x] `docker network ls` to confirm Traefik network name
- [x] `docker compose up -d --build`
- [x] `docker logs -f ical-proxy` for sanitized startup/errors
- [x] `curl -i https://ical-sync.ak-net.ru/health`
- [x] `curl -i https://ical-sync.ak-net.ru/calendar/wrong-token.ics`
- [x] `curl -i https://ical-sync.ak-net.ru/calendar/YOUR_TOKEN.ics`

Verified on 2026-05-07: real-token endpoint returned `200`, `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: public, max-age=300`, and a body containing `BEGIN:VCALENDAR`. The token was not printed.

## Implementation Notes for `/aif-implement`
- The target directory is the current workspace `/srv/projects/ical-sync`; implementation must not modify sibling projects.
- Ask before changing any real secret-bearing `.env` if one already exists.
- Follow project filename rules: use `kebab-case` for new source and test files.
- Do not restart or alter Traefik itself unless the user explicitly requests that privileged operational action.
