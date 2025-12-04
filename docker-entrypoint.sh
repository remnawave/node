#!/bin/sh

echo "[Entrypoint] Starting entrypoint script..."
supervisord -c /etc/supervisord.conf &
echo "[Entrypoint] Supervisord started successfully"
sleep 1
echo "[Entrypoint] Getting sing-box version..."
SINGBOX_VERSION=$(/usr/local/bin/sing-box version)
export SINGBOX_VERSION
echo "[Entrypoint] sing-box version: $SINGBOX_VERSION"

echo "[Entrypoint] Executing command: $@"
exec "$@"