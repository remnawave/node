ARG XRAY_IMAGE=ghcr.io/fedarisha/xray-core:latest

FROM ${XRAY_IMAGE} AS xray-source

FROM node:24.14-alpine AS build

WORKDIR /opt/app

ADD . .

RUN npm ci --legacy-peer-deps
RUN npm run build --omit=dev

RUN echo '#!/bin/sh' > /usr/local/bin/xlogs \
    && echo 'tail -n +1 -f /var/log/supervisor/xray.out.log' >> /usr/local/bin/xlogs \
    && chmod +x /usr/local/bin/xlogs

RUN echo '#!/bin/sh' > /usr/local/bin/xerrors \
    && echo 'tail -n +1 -f /var/log/supervisor/xray.err.log' >> /usr/local/bin/xerrors \
    && chmod +x /usr/local/bin/xerrors


FROM node:24.14-alpine

LABEL org.opencontainers.image.title="Fedarisha Node"
LABEL org.opencontainers.image.description="Remnawave Node with Fedarisha-enabled Xray Core"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

WORKDIR /opt/app

COPY --from=build /opt/app/dist /opt/app/dist
COPY --from=xray-source /usr/local/bin/xray /usr/local/bin/xray
COPY --from=xray-source /usr/local/share/xray/geoip.dat /usr/local/share/xray/geoip.dat
COPY --from=xray-source /usr/local/share/xray/geosite.dat /usr/local/share/xray/geosite.dat
COPY --from=build /usr/local/bin/xlogs /usr/local/bin/xlogs
COPY --from=build /usr/local/bin/xerrors /usr/local/bin/xerrors

COPY supervisord.conf /etc/supervisord.conf
COPY docker-entrypoint.sh /usr/local/bin/
COPY package*.json ./
COPY ./libs ./libs

RUN apk add --no-cache supervisor libnftnl libmnl && \
    mkdir -p /var/log/supervisor && \
    chmod +x /usr/local/bin/docker-entrypoint.sh && \
    ln -s /usr/local/bin/xray /usr/local/bin/rw-core

RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force \
    && npm link

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-http-header-size=65536"
ENV UV_THREADPOOL_SIZE=24

ENV XTLS_API_PORT=61000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "dist/src/main"]