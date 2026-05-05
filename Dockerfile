# syntax=docker/dockerfile:1.7

# Multi-stage build for self-host quickstart.
# Build:  docker build -t give-evidence .
# Run:    docker run --rm -p 3000:3000 give-evidence
# Or:     docker compose up

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION} AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json pnpm-lock.yaml ./
EXPOSE 3000
CMD ["pnpm", "run", "start"]
