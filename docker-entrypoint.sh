#!/bin/sh

echo "[Entrypoint] Starting entrypoint script..."

generate_random() {
    local l="$1"
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$l"
}

generate_hex() {
    local l="$1"
    tr -dc '0-9a-f' < /dev/urandom | head -c "$l"
}

RANDOM_HEX=$(generate_hex 16)
SUPERVISORD_USER=$(generate_random 64)
SUPERVISORD_PASSWORD=$(generate_random 64)
SUPERVISORD_SOCKET="/run/supervisord-$RANDOM_HEX.sock"
INTERNAL_REST_TOKEN=$(generate_random 64)
INTERNAL_API_SOCKET="/run/remnawave-internal-$RANDOM_HEX.sock"

export RANDOM_HEX
export SUPERVISORD_USER
export SUPERVISORD_PASSWORD
export SUPERVISORD_SOCKET
export INTERNAL_REST_TOKEN
export INTERNAL_API_SOCKET

echo "[Credentials] OK"

supervisord -c /etc/supervisord.conf &
echo "[Entrypoint] Supervisord started successfully"
sleep 1


echo "[Entrypoint] Getting Xray version..."

XRAY_CORE_VERSION=$(/usr/local/bin/rw-core version | head -n 1)
export XRAY_CORE_VERSION

echo "[Entrypoint] Xray version: $XRAY_CORE_VERSION"
echo "[Ports] XTLS_API_PORT: $XTLS_API_PORT"



echo "[Entrypoint] Executing command: $@"
exec "$@"