#!/bin/bash
# Fix container volume permission issues

set -euo pipefail

echo "🔧 Fixing container volume permissions..."

# Create shared directories with correct ownership
sudo mkdir -p data/uploads data/results
sudo chown -R $(id -u):$(id -g) data/

# Set appropriate permissions
chmod 755 data/uploads data/results

echo "✅ Volume permissions fixed"
echo "  📁 data/uploads: $(ls -ld data/uploads)"
echo "  📁 data/results: $(ls -ld data/results)"
