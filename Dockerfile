FROM node:22-alpine AS build
WORKDIR /opt/app
ADD . .
RUN npm ci --legacy-peer-deps
RUN npm run build --omit=dev


FROM node:22-alpine

ARG XRAY_CORE_VERSION=v25.9.11
ARG UPSTREAM_REPO=XTLS
ARG XRAY_CORE_INSTALL_SCRIPT=https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-xray.sh

RUN mkdir -p /var/log/supervisor

WORKDIR /opt/app
COPY --from=build /opt/app/dist ./dist

RUN echo '#!/bin/bash' > /usr/local/bin/xlogs \
    && echo 'tail -n +1 -f /var/log/supervisor/xray.out.log' >> /usr/local/bin/xlogs \
    && chmod +x /usr/local/bin/xlogs

RUN echo '#!/bin/bash' > /usr/local/bin/xerrors \
    && echo 'tail -n +1 -f /var/log/supervisor/xray.err.log' >> /usr/local/bin/xerrors \
    && chmod +x /usr/local/bin/xerrors

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

RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force


ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-http-header-size=65536"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "dist/src/main"]