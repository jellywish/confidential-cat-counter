#!/bin/bash
# Build verification script for reproducible builds
VERSION=${1:-latest}

echo "🔍 Verifying build reproducibility for version $VERSION"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "❌ jq not installed"; exit 1; }

# 1. Rebuild from source with deterministic timestamp
export SOURCE_DATE_EPOCH=1640995200
docker build --build-arg SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH \
  --platform linux/x86_64 -t ccc-ml:verify .

# 2. Compare image hashes
if [ -f "releases/$VERSION/attestation-data.json" ]; then
  EXPECTED=$(cat releases/$VERSION/attestation-data.json | jq -r '.image_sha384')
  ACTUAL=$(docker inspect ccc-ml:verify --format='{{index .RepoDigests 0}}' | cut -d'@' -f2)
  
  if [ "$EXPECTED" = "$ACTUAL" ]; then
    echo "✅ Build verification passed for version $VERSION"
    echo "   Expected: $EXPECTED"
    echo "   Actual:   $ACTUAL"
  else
    echo "❌ Build verification failed for version $VERSION"
    echo "   Expected: $EXPECTED"
    echo "   Actual:   $ACTUAL"
    exit 1
  fi
else
  echo "⚠️  No attestation data found for version $VERSION"
  echo "   Generated SHA384: $(docker inspect ccc-ml:verify --format='{{index .RepoDigests 0}}' | cut -d'@' -f2)"
fi

echo "🎯 Verification complete"
