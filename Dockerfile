FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend
COPY database ./database
COPY README.md ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173

EXPOSE 5173

CMD ["node", "backend/server.js"]
