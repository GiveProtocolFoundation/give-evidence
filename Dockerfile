# Multi-stage build for self-host quickstart per GIV-3 §self-host.
# Build with:   docker build -t give-evidence-spike .
# Run with:     docker run --rm -p 3000:3000 give-evidence-spike

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
