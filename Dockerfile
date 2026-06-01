FROM node:24.15-alpine AS build

WORKDIR /opt/app

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

COPY . .

RUN npm run build \
    && npm run trace


FROM alpine:3.21 AS xray

ARG XRAY_CORE_VERSION=v26.6.1
ARG UPSTREAM_REPO=XTLS
ARG XRAY_CORE_INSTALL_SCRIPT=https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-xray.sh
ARG ASN_LMDB_URL=https://github.com/remnawave/asn-index/releases/latest/download/asn-prefixes-lmdb.tar.gz

RUN apk add --no-cache curl \
    && curl -L ${XRAY_CORE_INSTALL_SCRIPT} | sh -s -- ${XRAY_CORE_VERSION} ${UPSTREAM_REPO} \
    && mkdir -p /usr/local/share/asn \
    && curl -L ${ASN_LMDB_URL} -o /tmp/asn-prefixes-lmdb.tar.gz \
    && tar -xzf /tmp/asn-prefixes-lmdb.tar.gz -C /usr/local/share/asn \
    && rm -f /tmp/asn-prefixes-lmdb.tar.gz


# ----- veil core -----------------------------------------------------
# Pulls the platform-matching `veil` static binary from the upstream
# release artefact set (linux/amd64 + arm64). The image multiplexes
# on TARGETARCH so a `docker buildx build --platform linux/arm64,...`
# bundle picks the right artefact without per-arch conditionals.
FROM alpine:3.21 AS veil

ARG VEIL_CORE_VERSION=v0.1.0-alpha.1
ARG VEIL_REPO=redstone-md/veil
ARG TARGETARCH

RUN apk add --no-cache curl ca-certificates \
    && case "${TARGETARCH}" in \
        amd64) VEIL_ARCH=amd64 ;; \
        arm64) VEIL_ARCH=arm64 ;; \
        *) echo "unsupported TARGETARCH=${TARGETARCH}" && exit 1 ;; \
       esac \
    && curl -fsSL "https://github.com/${VEIL_REPO}/releases/download/${VEIL_CORE_VERSION}/veil-linux-${VEIL_ARCH}" \
        -o /usr/local/bin/veil \
    && chmod +x /usr/local/bin/veil \
    && /usr/local/bin/veil --version


FROM node:24.15-alpine

LABEL org.opencontainers.image.title="Remnawave Node"
LABEL org.opencontainers.image.description="Remnawave Node with built-in XRay Core and Veil"
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

# Bundle Veil binary from the dedicated stage above.
COPY --from=veil /usr/local/bin/veil /usr/local/bin/veil

COPY supervisord.conf /etc/supervisord.conf
COPY docker-entrypoint.sh /usr/local/bin/

RUN apk add --no-cache supervisor libnftnl libmnl \
    && mkdir -p /var/log/supervisor /etc/veil /var/lib/veil \
    && chmod +x /usr/local/bin/docker-entrypoint.sh /opt/app/dist/cli.js \
    && ln -s /usr/local/bin/xray /usr/local/bin/rw-core \
    && ln -s /opt/app/dist/cli.js /usr/local/bin/cli \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/supervisor/xray.out.log\n' > /usr/local/bin/xlogs \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/supervisor/xray.err.log\n' > /usr/local/bin/xerrors \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/supervisor/veil.out.log\n' > /usr/local/bin/vlogs \
    && printf '#!/bin/sh\ntail -n +1 -f /var/log/supervisor/veil.err.log\n' > /usr/local/bin/verrors \
    && chmod +x /usr/local/bin/xlogs /usr/local/bin/xerrors /usr/local/bin/vlogs /usr/local/bin/verrors

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-http-header-size=65536"
ENV UV_THREADPOOL_SIZE=24

ENV XRAY_JSON_STRICT=true
# Surfaced to VeilService via process.env. Bumped automatically by
# the release pipeline when --build-arg VEIL_CORE_VERSION changes.
ENV VEIL_CORE_VERSION=${VEIL_CORE_VERSION}
ENV VEIL_BINARY_PATH=/usr/local/bin/veil

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "dist/main.js"]
