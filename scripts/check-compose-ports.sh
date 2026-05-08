#!/usr/bin/env bash
set -euo pipefail

base_config="$(PORT=3100 HOST_PORT=3900 docker compose -f docker-compose.yml config)"
overlay_config="$(PORT=3100 HOST_PORT=3900 TRAEFIK_HOST=example.org docker compose -f docker-compose.yml -f docker-compose.traefik.yml config)"

if ! printf '%s\n' "$base_config" | grep -Fq 'target: 3100'; then
  echo 'FAIL: base compose target port is not 3100 when PORT=3100'
  exit 1
fi

if ! printf '%s\n' "$base_config" | grep -Fq 'published: "3900"'; then
  echo 'FAIL: base compose published port is not 3900 when HOST_PORT=3900'
  exit 1
fi

if ! printf '%s\n' "$overlay_config" | grep -Fq 'traefik.http.services.ical-proxy.loadbalancer.server.port: "3100"'; then
  echo 'FAIL: traefik load balancer port is not 3100 when PORT=3100'
  exit 1
fi

echo 'OK: compose port mapping and Traefik target follow PORT/HOST_PORT overrides'
