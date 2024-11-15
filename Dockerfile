FROM node:22 as build
WORKDIR /opt/app
ADD . .
RUN npm ci --legacy-peer-deps
RUN npm run migrate:generate
RUN npm run build --prod


FROM node:22
WORKDIR /opt/app
COPY --from=build /opt/app/dist ./dist
ADD *.json ./
ADD ./prisma ./prisma
ADD ./libs ./libs
RUN npm ci --omit=dev --legacy-peer-deps
RUN npm run migrate:generate
CMD [ "npm", "run", "start:prod" ]
