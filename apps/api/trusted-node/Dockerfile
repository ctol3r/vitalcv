# Simple trusted node Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production || true
COPY . .
CMD ["npm", "start"]
