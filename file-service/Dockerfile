FROM node:20-alpine

WORKDIR /app

# copy entire repo (IMPORTANT)
COPY . .

# install shared dependencies
WORKDIR /app/shared
RUN npm install --omit=dev

# move into service
WORKDIR /app/file-service

RUN npm install --production

EXPOSE 3004

CMD ["node", "src/index.js"]
