FROM node:22-alpine AS build
WORKDIR /opt/app
ADD . .
RUN npm ci --legacy-peer-deps
RUN npm run build --omit=dev


FROM node:22-alpine

RUN mkdir -p /var/log/supervisor /var/lib/rnode/xray \
    && echo '{}' > /var/lib/rnode/xray/xray-config.json


WORKDIR /opt/app
COPY --from=build /opt/app/dist ./dist


RUN apk add --no-cache \
    curl \
    unzip \
    bash \
    supervisor \
    && curl -L https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-latest-xray.sh | bash -s -- v25.6.8 \
    && apk del curl

COPY supervisord.conf /etc/supervisord.conf
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh


COPY package*.json ./
COPY ./libs ./libs

RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["npm", "run", "start:prod"]