#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_root="$project_root"
temp_dir=""

if [[ ! -f "$project_root/.env" ]]; then
  if [[ ! -f "$project_root/.env.example" ]]; then
    echo 'FAIL: .env is missing and .env.example is not available for compose config checks'
    exit 1
  fi

  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' EXIT
  cp "$project_root/docker-compose.yml" "$temp_dir/docker-compose.yml"
  cp "$project_root/docker-compose.traefik.yml" "$temp_dir/docker-compose.traefik.yml"
  cp "$project_root/.env.example" "$temp_dir/.env"
  compose_root="$temp_dir"
  echo '[FIX:compose-env] .env not found; using .env.example in a temporary compose config workspace' >&2
fi

base_config="$(cd "$compose_root" && PORT=3100 HOST_PORT=3900 docker compose -f docker-compose.yml config)"
overlay_config="$(cd "$compose_root" && PORT=3100 HOST_PORT=3900 TRAEFIK_HOST=example.org docker compose -f docker-compose.yml -f docker-compose.traefik.yml config)"

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
