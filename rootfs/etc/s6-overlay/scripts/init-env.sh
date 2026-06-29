#!/command/with-contenv sh

echo "[init-env] preparing runtime environment..."

gen() {
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "${1:-64}"
}

RNDSTR=$(gen 10)
INTERNAL_REST_TOKEN=$(gen 64)
INTERNAL_SOCKET_PATH="rwint-${RNDSTR}"
XTLS_API_SOCKET_PATH="xtls-api-${RNDSTR}"

ENV_DIR=/run/s6/container_environment
mkdir -p "$ENV_DIR"

printf '%s' "$INTERNAL_REST_TOKEN"  > "$ENV_DIR/INTERNAL_REST_TOKEN"
printf '%s' "$INTERNAL_SOCKET_PATH" > "$ENV_DIR/INTERNAL_SOCKET_PATH"
printf '%s' "$XTLS_API_SOCKET_PATH" > "$ENV_DIR/XTLS_API_SOCKET_PATH"

if [ -n "${CUSTOM_CORE_URL:-}" ]; then
    echo "[init-env] CUSTOM_CORE_URL is set, downloading custom core from: $CUSTOM_CORE_URL"
    rm -f /usr/local/bin/xray
    if wget -q -O /usr/local/bin/xray "$CUSTOM_CORE_URL"; then
        chmod +x /usr/local/bin/xray
        echo "[init-env] custom core downloaded and installed successfully"
    else
        echo "[init-env] ERROR: failed to download custom core from: $CUSTOM_CORE_URL"
        exit 1
    fi
fi

XRAY_CORE_VERSION=$(/usr/local/bin/rw-core version | head -n 1)
printf '%s' "$XRAY_CORE_VERSION" > "$ENV_DIR/XRAY_CORE_VERSION"
echo "[init-env] Xray version: $XRAY_CORE_VERSION"

echo "[init-env] done."
exit 0
