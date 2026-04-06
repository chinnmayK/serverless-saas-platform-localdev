#!/bin/bash

echo "Checking changed files..."

CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD || true)
echo "$CHANGED_FILES"

RUN_ANALYSIS=false
RUN_BUILD=false
RUN_DEPLOY=false

PROJECT_NAME="saas-platform"
SERVICES=("api-gateway" "user-service" "tenant-service" "billing-service" "file-service")

########################################
# Detect empty ECR repositories
########################################

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="$ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com"

echo "Checking if ECR images exist..."

ECR_EMPTY=false

for service in "${SERVICES[@]}"; do

  IMAGE_COUNT=$(aws ecr describe-images \
      --repository-name "$PROJECT_NAME-$service" \
      --region "$AWS_DEFAULT_REGION" \
      --query 'imageDetails | length(@)' \
      --output text 2>/dev/null || echo 0)

  if [ "$IMAGE_COUNT" = "0" ]; then
      echo "Repository $PROJECT_NAME-$service has no images"
      ECR_EMPTY=true
  fi

done

########################################
# If no images exist → force full build
########################################

if [ "$ECR_EMPTY" = true ]; then

  echo "First deployment detected → forcing full build"

  RUN_ANALYSIS=true
  RUN_BUILD=true
  RUN_DEPLOY=true

else

  echo "Existing images found → using optimized pipeline"

  for file in $CHANGED_FILES
  do
    if [[ $file == *.js || $file == package.json ]]; then
        RUN_ANALYSIS=true
        RUN_BUILD=true
        RUN_DEPLOY=true
    fi

    if [[ $file == Dockerfile ]]; then
        RUN_BUILD=true
        RUN_DEPLOY=true
    fi

    if [[ $file == terraform/* ]]; then
        RUN_DEPLOY=true
    fi
  done

fi

echo "RUN_ANALYSIS=$RUN_ANALYSIS"
echo "RUN_BUILD=$RUN_BUILD"
echo "RUN_DEPLOY=$RUN_DEPLOY"

cat <<EOF > pipeline.env
RUN_ANALYSIS=$RUN_ANALYSIS
RUN_BUILD=$RUN_BUILD
RUN_DEPLOY=$RUN_DEPLOY
EOF

echo "pipeline.env created:"
cat pipeline.env