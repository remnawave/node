FROM node:24.13-alpine AS build

ARG XRAY_CORE_VERSION=v25.12.8
ARG UPSTREAM_REPO=XTLS
ARG XRAY_CORE_INSTALL_SCRIPT=https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-xray.sh

WORKDIR /opt/app

ADD . .

RUN npm ci --legacy-peer-deps
RUN npm run build --omit=dev

RUN apk add --no-cache curl unzip bash \
    && curl -L ${XRAY_CORE_INSTALL_SCRIPT} | bash -s -- ${XRAY_CORE_VERSION} ${UPSTREAM_REPO}

RUN echo '#!/bin/sh' > /usr/local/bin/rw-logs \
    && echo 'tail -n +1 -f /var/log/supervisor/xray.out.log' >> /usr/local/bin/rw-logs \
    && chmod +x /usr/local/bin/rw-logs

RUN echo '#!/bin/sh' > /usr/local/bin/rw-errors \
    && echo 'tail -n +1 -f /var/log/supervisor/xray.err.log' >> /usr/local/bin/rw-errors \
    && chmod +x /usr/local/bin/rw-errors


FROM node:24.13-alpine

# app
COPY --from=build /opt/app/dist /opt/app/dist
# xray
COPY --from=build /usr/local/bin/xray /usr/local/bin/xray
COPY --from=build /usr/local/share/xray/geoip.dat /usr/local/share/xray/geoip.dat
COPY --from=build /usr/local/share/xray/geosite.dat /usr/local/share/xray/geosite.dat
# logs and errors helpers
COPY --from=build /usr/local/bin/rw-logs /usr/local/bin/rw-logs
COPY --from=build /usr/local/bin/rw-errors /usr/local/bin/rw-errors

RUN ln -s /usr/local/bin/xray /usr/local/bin/rw-core

RUN apk add --no-cache supervisor
RUN mkdir -p /var/log/supervisor

COPY supervisord.conf /etc/supervisord.conf
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /opt/app

COPY package*.json ./
COPY ./libs ./libs

RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-http-header-size=65536"

ENV XTLS_API_PORT=61000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "dist/src/main"]