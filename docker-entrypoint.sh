#!/bin/sh

echo "[Entrypoint] Starting entrypoint script..."
supervisord -c /etc/supervisord.conf &
echo "[Entrypoint] Supervisord started successfully"
sleep 1
echo "[Entrypoint] Getting Xray version..."
XRAY_CORE_VERSION=$(/usr/local/bin/rw-core version | head -n 1)
export XRAY_CORE_VERSION
echo "[Entrypoint] Xray version: $XRAY_CORE_VERSION"


echo "[Ports] SUPERVISORD_PORT: $SUPERVISORD_PORT"
echo "[Ports] INTERNAL_REST_PORT: $INTERNAL_REST_PORT"
echo "[Ports] XTLS_API_PORT: $XTLS_API_PORT"

echo "[Entrypoint] Executing command: $@"
exec "$@"