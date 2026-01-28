#!/bin/sh

echo "[Entrypoint] Starting entrypoint script..."

generate_random() {
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 32
}

SUPERVISORD_USER=$(generate_random)
SUPERVISORD_PASSWORD=$(generate_random)
INTERNAL_REST_TOKEN=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 64)

echo "[Credentials] OK"

supervisord -c /etc/supervisord.conf &
echo "[Entrypoint] Supervisord started successfully"
sleep 1


echo "[Entrypoint] Getting Xray version..."

XRAY_CORE_VERSION=$(/usr/local/bin/rw-core version | head -n 1)

echo "[Entrypoint] Xray version: $XRAY_CORE_VERSION"
echo "[Ports] XTLS_API_PORT: $XTLS_API_PORT"


export SUPERVISORD_USER
export SUPERVISORD_PASSWORD
export INTERNAL_REST_TOKEN
export XRAY_CORE_VERSION

echo "[Entrypoint] Executing command: $@"
exec "$@"