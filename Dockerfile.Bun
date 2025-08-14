FROM node:22-alpine AS build
WORKDIR /opt/app
ADD . .
RUN npm ci --legacy-peer-deps
RUN npm run build --omit=dev

RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force

FROM oven/bun:1.2.20-alpine AS base

ARG XRAY_CORE_VERSION=v25.8.3
ARG UPSTREAM_REPO=XTLS
ARG XRAY_CORE_INSTALL_SCRIPT=https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-xray.sh

RUN mkdir -p /var/log/supervisor

WORKDIR /opt/app
COPY --from=build /opt/app/dist ./dist
COPY --from=build /opt/app/node_modules ./node_modules


RUN apk add --no-cache \
    curl \
    unzip \
    bash \
    git \
    python3 \
    py3-pip \
    && pip3 install --break-system-packages git+https://github.com/Supervisor/supervisor.git@4bf1e57cbf292ce988dc128e0d2c8917f18da9be \
    && curl -L ${XRAY_CORE_INSTALL_SCRIPT} | bash -s -- ${XRAY_CORE_VERSION} ${UPSTREAM_REPO} \
    && apk del curl git

COPY supervisord.conf /etc/supervisord.conf
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh


COPY package*.json ./
COPY ./libs ./libs

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["bun", "run", "start:bun"]
