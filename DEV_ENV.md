```bash
docker compose -f docker-compose-dev.yml up -d
```

```bash
docker exec -it remnawave-node-dev /bin/bash
```

Install NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
```

```bash
nvm install v22.12.0 && nvm use v22.12.0
```

```bash
for f in /run/s6/container_environment/*; do export "$(basename "$f")=$(cat "$f")"; done
```

```bash
curl -L https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-latest-xray.sh -o install-xray.sh \
    && chmod +x install-xray.sh \
    && bash ./install-xray.sh \
    && rm install-xray.sh
```
