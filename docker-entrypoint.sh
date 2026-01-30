#!/bin/sh

rm -f /run/remnawave-internal-*.sock 2>/dev/null
rm -f /run/supervisord-*.sock 2>/dev/null
rm -f /run/supervisord-*.pid 2>/dev/null

echo "[Entrypoint] Starting entrypoint script..."

generate_random() {
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 64
}

RNDSTR=$(head -c 20 /dev/urandom | xxd -p | head -c 10)
SUPERVISORD_USER=$(generate_random)
SUPERVISORD_PASSWORD=$(generate_random)
INTERNAL_REST_TOKEN=$(generate_random)

INTERNAL_SOCKET_PATH=/run/remnawave-internal-${RNDSTR}.sock
SUPERVISORD_SOCKET_PATH=/run/supervisord-${RNDSTR}.sock
SUPERVISORD_PID_PATH=/run/supervisord-${RNDSTR}.pid

export SUPERVISORD_USER
export SUPERVISORD_PASSWORD
export INTERNAL_REST_TOKEN
export INTERNAL_SOCKET_PATH
export SUPERVISORD_SOCKET_PATH
export SUPERVISORD_PID_PATH

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