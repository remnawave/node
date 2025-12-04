FROM node:22-alpine AS build
WORKDIR /opt/app
ADD . .
RUN npm ci --legacy-peer-deps
RUN npm run build --omit=dev


FROM node:22-alpine

ARG SINGBOX_VERSION=latest
ARG UPSTREAM_REPO=SagerNet

RUN mkdir -p /var/log/supervisor

WORKDIR /opt/app
COPY --from=build /opt/app/dist ./dist

RUN echo '#!/bin/bash' > /usr/local/bin/sblogs \
    && echo 'tail -n +1 -f /var/log/supervisor/singbox.out.log' >> /usr/local/bin/sblogs \
    && chmod +x /usr/local/bin/sblogs

RUN echo '#!/bin/bash' > /usr/local/bin/sberrors \
    && echo 'tail -n +1 -f /var/log/supervisor/singbox.err.log' >> /usr/local/bin/sberrors \
    && chmod +x /usr/local/bin/sberrors

COPY install.sh /tmp/install.sh

RUN apk add --no-cache \
    curl \
    tar \
    bash \
    git \
    python3 \
    py3-pip \
    && pip3 install --break-system-packages git+https://github.com/Supervisor/supervisor.git@4bf1e57cbf292ce988dc128e0d2c8917f18da9be \
    && chmod +x /tmp/install.sh \
    && /tmp/install.sh ${SINGBOX_VERSION} ${UPSTREAM_REPO} \
    && rm /tmp/install.sh \
    && apk del git

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