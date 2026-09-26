# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi


FROM base AS build

WORKDIR /app

COPY . .

ENV NODE_ENV=production

RUN npm run build


FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
