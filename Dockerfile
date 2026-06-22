FROM node:24.16-alpine AS build

WORKDIR /opt/app

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

COPY . .

RUN npm run build \
    && npm run trace \
    && find dist/node_modules/@lmdb -name '*.glibc.node' -delete


FROM alpine:3.21 AS xray

ARG XRAY_CORE_VERSION=v26.6.22
ARG UPSTREAM_REPO=XTLS
ARG XRAY_CORE_INSTALL_SCRIPT=https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-xray.sh
ARG ASN_LMDB_URL=https://github.com/remnawave/asn-index/releases/latest/download/asn-prefixes-lmdb.tar.gz

RUN apk add --no-cache curl \
    && curl -L ${XRAY_CORE_INSTALL_SCRIPT} | sh -s -- ${XRAY_CORE_VERSION} ${UPSTREAM_REPO} \
    && mkdir -p /usr/local/share/asn \
    && curl -L ${ASN_LMDB_URL} -o /tmp/asn-prefixes-lmdb.tar.gz \
    && tar -xzf /tmp/asn-prefixes-lmdb.tar.gz -C /usr/local/share/asn \
    && rm -f /tmp/asn-prefixes-lmdb.tar.gz


FROM node:24.16-alpine

ARG S6_OVERLAY_VERSION=3.2.0.2

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
COPY --from=xray /usr/local/share/asn /usr/local/share/asn

COPY rootfs/ /

RUN apk add --no-cache ca-certificates xz libnftnl libmnl \
    && S6_ARCH="$(uname -m)" \
    && wget -qO /tmp/s6-noarch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" \
    && wget -qO /tmp/s6-arch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" \
    && xz -dc /tmp/s6-noarch.tar.xz | tar -C / -xpf - \
    && xz -dc /tmp/s6-arch.tar.xz | tar -C / -xpf - \
    && rm -f /tmp/s6-noarch.tar.xz /tmp/s6-arch.tar.xz \
    && mkdir -p /var/log/xray \
    && chmod +x /opt/app/dist/cli.js \
        /etc/s6-overlay/scripts/init-env.sh \
        /etc/s6-overlay/s6-rc.d/xray/run \
        /etc/s6-overlay/s6-rc.d/xray-log/run \
    && ln -s /usr/local/bin/xray /usr/local/bin/rw-core \
    && ln -s /opt/app/dist/cli.js /usr/local/bin/cli \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/xray/current\n' > /usr/local/bin/xlogs \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/xray/current\n' > /usr/local/bin/xerrors \
    && chmod +x /usr/local/bin/xlogs /usr/local/bin/xerrors \
    && apk del xz \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/include/node

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-http-header-size=65536"
ENV UV_THREADPOOL_SIZE=24

ENV XRAY_JSON_STRICT=true

ENV S6_VERBOSITY=1

ENTRYPOINT ["/init"]

CMD ["/command/with-contenv", "node", "dist/main.js"]