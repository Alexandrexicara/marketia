# MarketIA API — imagem usada pelo serviço Docker do Render
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./

EXPOSE 4000
CMD ["npm", "start"]
