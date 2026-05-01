FROM node:24.15-alpine AS deps

WORKDIR /opt/app

COPY package*.json ./
RUN npm ci


FROM node:24.15-alpine AS build

WORKDIR /opt/app

COPY --from=deps /opt/app/node_modules ./node_modules
COPY . .

RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force


FROM node:24.15-alpine AS xray

ARG XRAY_CORE_VERSION=v26.4.25
ARG UPSTREAM_REPO=XTLS
ARG XRAY_CORE_INSTALL_SCRIPT=https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-xray.sh
ARG ASN_LMDB_URL=https://github.com/remnawave/asn-index/releases/latest/download/asn-prefixes-lmdb.tar.gz

RUN apk add --no-cache curl \
    && curl -L ${XRAY_CORE_INSTALL_SCRIPT} | sh -s -- ${XRAY_CORE_VERSION} ${UPSTREAM_REPO} \
    && mkdir -p /usr/local/share/asn \
    && curl -L ${ASN_LMDB_URL} -o /tmp/asn-prefixes-lmdb.tar.gz \
    && tar -xzf /tmp/asn-prefixes-lmdb.tar.gz -C /usr/local/share/asn \
    && rm -f /tmp/asn-prefixes-lmdb.tar.gz


FROM node:24.15-alpine

LABEL org.opencontainers.image.title="Remnawave Node"
LABEL org.opencontainers.image.description="Remnawave Node with built-in XRay Core"
LABEL org.opencontainers.image.url="https://github.com/remnawave/node"
LABEL org.opencontainers.image.source="https://github.com/remnawave/node"
LABEL org.opencontainers.image.vendor="Remnawave"
LABEL org.opencontainers.image.licenses="AGPL-3.0"
LABEL org.opencontainers.image.documentation="https://docs.rw"

WORKDIR /opt/app

COPY --from=build /opt/app/dist ./dist
COPY --from=build /opt/app/node_modules ./node_modules
COPY --from=build /opt/app/package.json ./package.json

COPY --from=xray /usr/local/bin/xray /usr/local/bin/xray
COPY --from=xray /usr/local/share/xray/geoip.dat /usr/local/share/xray/geoip.dat
COPY --from=xray /usr/local/share/xray/geosite.dat /usr/local/share/xray/geosite.dat
COPY --from=xray /usr/local/share/asn /usr/local/share/asn

COPY supervisord.conf /etc/supervisord.conf
COPY docker-entrypoint.sh /usr/local/bin/

RUN apk add --no-cache supervisor libnftnl libmnl \
    && mkdir -p /var/log/supervisor \
    && chmod +x /usr/local/bin/docker-entrypoint.sh /opt/app/dist/cli.js \
    && ln -s /usr/local/bin/xray /usr/local/bin/rw-core \
    && ln -s /opt/app/dist/cli.js /usr/local/bin/cli \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/supervisor/xray.out.log\n' > /usr/local/bin/xlogs \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/supervisor/xray.err.log\n' > /usr/local/bin/xerrors \
    && chmod +x /usr/local/bin/xlogs /usr/local/bin/xerrors

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-http-header-size=65536"
ENV UV_THREADPOOL_SIZE=24

ENV XRAY_JSON_STRICT=1
ENV XTLS_API_PORT=61000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "dist/main.js"]