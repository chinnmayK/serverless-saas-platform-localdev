FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

# copy entire repo (IMPORTANT)
COPY . .

# install shared dependencies
WORKDIR /app/shared
RUN npm install --omit=dev

# move into service
WORKDIR /app/billing-service

RUN npm install --production

EXPOSE 3003

CMD ["node", "src/index.js"]
