FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.ts ./
COPY firebase-applet-config.json ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
RUN npm install -g tsx
CMD ["tsx", "server.ts"]
