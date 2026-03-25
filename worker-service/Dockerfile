FROM node:20-alpine

WORKDIR /app

# copy entire repo (IMPORTANT)
COPY . .

# install shared dependencies
WORKDIR /app/shared
RUN npm install --omit=dev

# move into service
WORKDIR /app/worker-service

RUN npm install --production

CMD ["node", "src/index.js"]
