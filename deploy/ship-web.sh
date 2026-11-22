#!/usr/bin/env bash
# Builds the React app and publishes it to the private S3 web bucket behind CloudFront (stack "compineu").
#   AWS_PROFILE=<profile> bash deploy/ship-web.sh
# The page and the API share one CloudFront origin, so the API base is "" (same origin, paths start with /api)
# and the backend needs no CORS.
set -euo pipefail
export MSYS_NO_PATHCONV=1
export AWS_REGION="${AWS_REGION:-ap-south-1}" AWS_DEFAULT_REGION="${AWS_REGION:-ap-south-1}"
STACK="${STACK:-${PROJECT:-compineu}}"
cd "$(dirname "$0")/.."

out() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out WebBucket); DIST=$(out DistributionId); URL=$(out AppUrl)

[ -d node_modules ] || npm ci
VITE_API_BASE_URL="" npm run build

DIST_DIR="dist"; command -v cygpath >/dev/null && DIST_DIR="$(cygpath -w "$PWD/dist")"
# Hashed assets cache for a year; index.html must always be re-fetched so new builds show up at once.
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete --only-show-errors --exclude index.html \
  --cache-control "public,max-age=31536000,immutable"
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" --only-show-errors --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/index.html" "/" --query Invalidation.Id --output text >/dev/null
echo "published to $URL"
