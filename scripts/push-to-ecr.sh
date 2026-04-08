#!/bin/bash

set -e

AWS_REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

ECR_BASE="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
PROJECT="saas-platform"

SERVICES=(
  "api-gateway"
  "user-service"
  "tenant-service"
  "billing-service"
  "file-service"
)

echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login \
  --username AWS \
  --password-stdin $ECR_BASE

for SERVICE in "${SERVICES[@]}"
do
  echo "--------------------------------------"
  echo "Building $SERVICE..."

  docker build -f $SERVICE/Dockerfile -t $SERVICE .

  IMAGE_URI="$ECR_BASE/$PROJECT-$SERVICE:latest"

  echo "Tagging $SERVICE..."
  docker tag $SERVICE:latest $IMAGE_URI

  echo "Pushing $SERVICE..."
  docker push $IMAGE_URI

done

echo "✅ All images pushed successfully!"