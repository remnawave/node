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

# Установка sing-box
COPY install.sh /tmp/install.sh
RUN chmod +x /tmp/install.sh \
    && /tmp/install.sh latest \
    && rm /tmp/install.sh


RUN mkdir -p /var/log/supervisor /var/lib/rnode/singbox /app \
    && echo '{}' > /var/lib/rnode/singbox/singbox-config.json

WORKDIR /app


EXPOSE 24000

COPY supervisord.conf /var/lib/rnode/singbox/supervisor.conf

RUN echo '#!/bin/bash\n\
    supervisord -c /var/lib/rnode/singbox/supervisor.conf &\n\
    exec "$@"' > /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD tail -f /dev/null
