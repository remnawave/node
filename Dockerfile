# FROM node:20 as build
# WORKDIR /opt/app
# ADD . .
# RUN npm ci --legacy-peer-deps
# RUN npm run build --prod


# FROM node:20
# WORKDIR /opt/app
# COPY --from=build /opt/app/dist ./dist

# RUN apt-get update \
#     && apt-get install -y curl unzip \
#     && rm -rf /var/lib/apt/lists/*
# RUN bash -c "$(curl -L https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-latest-xray.sh)"

# WORKDIR /opt/app

# ADD *.json ./
# ADD ./libs ./libs
# RUN npm ci --omit=dev --legacy-peer-deps
# CMD [ "npm", "run", "start:prod" ]



FROM node:20-alpine as build
WORKDIR /opt/app
ADD . .
RUN npm ci --legacy-peer-deps
RUN npm run build --prod


FROM node:20-alpine
WORKDIR /opt/app
COPY --from=build /opt/app/dist ./dist


RUN apk add --no-cache curl unzip \
    && curl -L https://raw.githubusercontent.com/remnawave/scripts/main/scripts/install-latest-xray.sh -o install-xray.sh \
    && chmod +x install-xray.sh \
    && ./install-xray.sh \
    && rm install-xray.sh


COPY package*.json ./
COPY ./libs ./libs
RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force

CMD [ "npm", "run", "start:prod" ]