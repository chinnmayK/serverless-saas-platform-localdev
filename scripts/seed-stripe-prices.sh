#!/bin/bash
docker compose exec -T saas_db psql -U app_user -d saas_db \
  -c "UPDATE plans SET stripe_price_id = '${STRIPE_PRO_PRICE_ID}' WHERE id = 'pro';"
