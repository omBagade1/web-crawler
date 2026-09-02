FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p logs crawl-state public

ENV NODE_ENV=production
ENV PORT=3000
ENV CRAWL_STATE_DIR=/app/crawl-state

EXPOSE 3000

USER node

CMD ["node", "index.js"]