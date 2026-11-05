#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p logs data

HEALTH_URL="http://127.0.0.1:4173/api/health"
if curl --fail --silent --show-error --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
  echo "AulaRaíz ya está ejecutándose en el puerto 4173."
  exit 0
fi

# Ejecutar con el mismo servidor Node.js usado en la PC.
nohup node server/index.mjs >>logs/codespaces.log 2>&1 </dev/null &
server_pid=$!

for attempt in {1..40}; do
  if curl --fail --silent --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "AulaRaíz lista. Abre el puerto 4173 en la pestaña PUERTOS."
    exit 0
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "El servidor de AulaRaíz se detuvo al iniciar." >&2
    tail -n 40 logs/codespaces.log >&2 || true
    exit 1
  fi
  sleep 0.5
done

echo "AulaRaíz no respondió en el puerto 4173." >&2
tail -n 40 logs/codespaces.log >&2 || true
exit 1
