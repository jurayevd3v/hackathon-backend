# 1. Build bosqichi 
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g @nestjs/cli && npm install
COPY . .
RUN npm run build

# 2. Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
#RUN npm install -g wait-port
EXPOSE 5000
CMD ["node", "dist/main.js"]
