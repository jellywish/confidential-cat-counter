#!/bin/bash
# Cache ONNX model locally to avoid download failures during Docker build

set -euo pipefail

MODEL_DIR="./src/ml-service/models"
MODEL_FILE="$MODEL_DIR/yolov5s.onnx"
MODEL_URL="https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5s.onnx"

echo "🔧 Caching ONNX model locally..."

# Create models directory if it doesn't exist
mkdir -p "$MODEL_DIR"

# Download model if not already cached
if [ ! -f "$MODEL_FILE" ]; then
    echo "📥 Downloading YOLOv5s ONNX model..."
    if wget -O "$MODEL_FILE" "$MODEL_URL"; then
        echo "✅ Model downloaded successfully: $(ls -lh $MODEL_FILE)"
        
        # Verify it's actually an ONNX file (not HTML error page)
        if file "$MODEL_FILE" | grep -q "data"; then
            echo "✅ Model file verified as binary data"
        else
            echo "❌ Model file appears to be text (possibly error page)"
            rm -f "$MODEL_FILE"
            exit 1
        fi
    else
        echo "❌ Model download failed"
        exit 1
    fi
else
    echo "✅ Model already cached: $(ls -lh $MODEL_FILE)"
fi

echo "🎯 Model ready for Docker build"
