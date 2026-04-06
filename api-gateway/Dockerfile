FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

# copy entire repo (IMPORTANT)
COPY . .

# install shared dependencies
WORKDIR /app/shared
RUN npm install --omit=dev

# move into service
WORKDIR /app/api-gateway

RUN npm install --production

EXPOSE 3000

CMD ["node", "src/index.js"]
