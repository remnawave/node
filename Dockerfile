FROM node:22-alpine AS build
WORKDIR /opt/app
ADD . .
RUN npm ci --legacy-peer-deps
RUN npm run build --omit=dev


FROM node:22-alpine

ARG XRAY_CORE_VERSION=v25.8.3
ARG UPSTREAM_REPO=XTLS
ARG XRAY_CORE_INSTALL_SCRIPT=https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-xray.sh

RUN mkdir -p /var/log/supervisor

WORKDIR /opt/app
COPY --from=build /opt/app/dist ./dist


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

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["npm", "run", "start:prod"]