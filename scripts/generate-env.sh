#!/bin/bash

set -e

echo "Generating .env files..."

for SERVICE in api-gateway user-service tenant-service billing-service file-service
do
  cat <<EOF > $SERVICE/.env
NODE_ENV=production
PORT=3000

JWT_SECRET=$JWT_SECRET
REDIS_URL=$REDIS_URL
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=$DATABASE_URL
EOF

done

echo "✅ .env files generated"