FROM mcr.microsoft.com/devcontainers/base:jammy


RUN apt-get update && apt-get install -y \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*


ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install v24.12.0 \
    && nvm alias default v24.12.0 \
    && nvm use default


ENV PATH="/root/.nvm/versions/node/v24.12.0/bin:${PATH}"

RUN curl -L https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-latest-xray.sh | bash -s -- v26.3.27


ARG ASN_LMDB_URL=https://github.com/remnawave/asn-index/releases/latest/download/asn-prefixes-lmdb.tar.gz

RUN mkdir -p /var/log/supervisor /var/lib/rnode/xray /app /usr/local/share/asn \
    && echo '{}' > /var/lib/rnode/xray/xray-config.json \
    && curl -L ${ASN_LMDB_URL} -o /tmp/asn-prefixes-lmdb.tar.gz \
    && tar -xzf /tmp/asn-prefixes-lmdb.tar.gz -C /usr/local/share/asn \
    && rm -f /tmp/asn-prefixes-lmdb.tar.gz

WORKDIR /app


EXPOSE 24000

COPY supervisord.conf /var/lib/rnode/xray/supervisor.conf

RUN echo '#!/bin/bash\n\
    supervisord -c /var/lib/rnode/xray/supervisor.conf &\n\
    exec "$@"' > /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh


ENV XTLS_API_PORT=61000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD tail -f /dev/null
