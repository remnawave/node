# syntax=docker/dockerfile:1.7

FROM node:24.19-trixie-slim AS build

WORKDIR /opt/app

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

COPY . .

RUN npm run build \
    && npm run trace \
    && find dist/node_modules/@lmdb -name '*.node' ! -name 'node.napi.glibc.node' -delete \
    && ARCH=$([ "$(uname -m)" = aarch64 ] && echo linux-arm64 || echo linux-x64) \
    && find dist/node_modules/nftables-napi/prebuilds -name '*.musl.node' -delete \
    && find dist/node_modules/nftables-napi/prebuilds -mindepth 1 -maxdepth 1 -type d ! -name "$ARCH" -exec rm -rf {} + \
    && chmod +x dist/cli.js


FROM alpine:3.21 AS xray

ARG XRAY_CORE_VERSION=v26.7.28
ARG UPSTREAM_REPO=XTLS
ARG TARGETARCH

RUN apk add --no-cache curl \
    && case "${TARGETARCH}" in \
        amd64) ARCHIVE='Xray-linux-64.zip' ;; \
        arm64) ARCHIVE='Xray-linux-arm64-v8a.zip' ;; \
    esac \
    && BASE="https://github.com/${UPSTREAM_REPO}/Xray-core/releases/download/${XRAY_CORE_VERSION}" \
    && curl -fsSL -o "/tmp/${ARCHIVE}" "${BASE}/${ARCHIVE}" \
    && curl -fsSL -o /tmp/xray.dgst "${BASE}/${ARCHIVE}.dgst" \
    && echo "$(awk '/^SHA2-256=/ { print $2 }' /tmp/xray.dgst)  /tmp/${ARCHIVE}" | sha256sum -c - \
    && unzip -q "/tmp/${ARCHIVE}" -d /tmp/xray \
    && install -m 755 /tmp/xray/xray /usr/local/bin/xray \
    && install -d /usr/local/share/xray \
    && install -m 644 /tmp/xray/geoip.dat /usr/local/share/xray/geoip.dat \
    && install -m 644 /tmp/xray/geosite.dat /usr/local/share/xray/geosite.dat \
    && rm -rf "/tmp/${ARCHIVE}" /tmp/xray /tmp/xray.dgst


FROM alpine:3.21 AS asn

ARG ASN_LMDB_URL=https://github.com/remnawave/asn-index/releases/latest/download/asn-prefixes.lmdb.zst

RUN apk add --no-cache zstd

ADD ${ASN_LMDB_URL} /tmp/asn-prefixes.lmdb.zst

RUN mkdir -p /usr/local/share/asn \
    && zstd -d /tmp/asn-prefixes.lmdb.zst -o /usr/local/share/asn/asn-prefixes.lmdb \
    && chmod 644 /usr/local/share/asn/asn-prefixes.lmdb \
    && rm -f /tmp/asn-prefixes.lmdb.zst


FROM alpine:3.21 AS geocheck

ARG GEOCHECK_VERSION=0.3.0
ARG GEOCHECK_RELEASE_URL=https://github.com/remnawave/geocheck/releases/download
ARG TARGETARCH

RUN apk add --no-cache curl \
    && cd /tmp \
    && ARCHIVE="geocheck_linux_${TARGETARCH}.tar.gz" \
    && curl -fsSL -O "${GEOCHECK_RELEASE_URL}/v${GEOCHECK_VERSION}/${ARCHIVE}" \
    && curl -fsSL -O "${GEOCHECK_RELEASE_URL}/v${GEOCHECK_VERSION}/checksums.txt" \
    && grep "  ${ARCHIVE}\$" checksums.txt | sha256sum -c - \
    && tar -xzf "${ARCHIVE}" geocheck \
    && install -m 0755 geocheck /usr/local/bin/geocheck \
    && rm -rf /tmp/*


FROM scratch AS integration-bin


FROM node:24.19-trixie-slim

ARG S6_OVERLAY_VERSION=3.2.3.2

LABEL org.opencontainers.image.title="Remnawave Node"
LABEL org.opencontainers.image.description="Remnawave Node with built-in XRay Core"
LABEL org.opencontainers.image.url="https://github.com/remnawave/node"
LABEL org.opencontainers.image.source="https://github.com/remnawave/node"
LABEL org.opencontainers.image.vendor="Remnawave"
LABEL org.opencontainers.image.licenses="AGPL-3.0"
LABEL org.opencontainers.image.documentation="https://docs.rw"

WORKDIR /opt/app

COPY --from=build /opt/app/dist ./dist

COPY --from=xray /usr/local/bin/xray /usr/local/bin/xray
COPY --from=xray /usr/local/share/xray/geoip.dat /usr/local/share/xray/geoip.dat
COPY --from=xray /usr/local/share/xray/geosite.dat /usr/local/share/xray/geosite.dat
COPY --from=asn /usr/local/share/asn /usr/local/share/asn
COPY --from=geocheck /usr/local/bin/geocheck /usr/local/bin/geocheck

COPY docker/rootfs/ /

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates wget xz-utils \
    && S6_ARCH="$(uname -m)" \
    && wget -qO /tmp/s6-noarch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" \
    && wget -qO /tmp/s6-arch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" \
    && xz -dc /tmp/s6-noarch.tar.xz | tar -C / -xpf - \
    && xz -dc /tmp/s6-arch.tar.xz | tar -C / -xpf - \
    && rm -f /tmp/s6-noarch.tar.xz /tmp/s6-arch.tar.xz \
    && mkdir -p /var/log/xray \
    && chmod +x /etc/s6-overlay/scripts/init-env.sh \
        /etc/s6-overlay/s6-rc.d/xray/run \
        /etc/s6-overlay/s6-rc.d/xray-log/run \
    && ln -s /usr/local/bin/xray /usr/local/bin/rw-core \
    && ln -s /opt/app/dist/cli.js /usr/local/bin/cli \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/xray/current\n' > /usr/local/bin/xlogs \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/xray/current\n' > /usr/local/bin/xerrors \
    && chmod +x /usr/local/bin/xlogs /usr/local/bin/xerrors \
    && apt-get purge -y --auto-remove xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/include/node

ARG INTEGRATIONS=""

RUN --mount=type=bind,source=docker/integrations,target=/mnt/integrations \
    --mount=type=bind,from=integration-bin,target=/mnt/bin \
    sh /mnt/integrations/install.sh "${INTEGRATIONS}"

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-http-header-size=65536"
ENV UV_THREADPOOL_SIZE=24
ENV XRAY_JSON_STRICT=true
ENV S6_VERBOSITY=1

ENTRYPOINT ["/init"]

CMD ["/command/with-contenv", "node", "dist/main.js"]
