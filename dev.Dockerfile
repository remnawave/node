FROM mcr.microsoft.com/devcontainers/base:jammy


RUN apt-get update && apt-get install -y \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*


ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install v22.14.0 \
    && nvm alias default v22.14.0 \
    && nvm use default


ENV PATH="/root/.nvm/versions/node/v22.14.0/bin:${PATH}"

# Установка Xray
RUN curl -L https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-latest-xray.sh | bash -s -- v25.6.8


RUN mkdir -p /var/log/supervisor /var/lib/rnode/xray /app \
    && echo '{}' > /var/lib/rnode/xray/xray-config.json

WORKDIR /app


EXPOSE 24000

COPY supervisord.conf /var/lib/rnode/xray/supervisor.conf

RUN echo '#!/bin/bash\n\
    supervisord -c /var/lib/rnode/xray/supervisor.conf &\n\
    exec "$@"' > /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD tail -f /dev/null
