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
sudo apt update && sudo apt install supervisor
```

run supervisor

```bash
supervisord -c supervisord.conf &
```

```bash
curl -L https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-latest-xray.sh -o install-xray.sh \
    && chmod +x install-xray.sh \
    && bash ./install-xray.sh \
    && rm install-xray.sh
```
