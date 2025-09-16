FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    python3-opencv \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create app user
RUN addgroup --gid 1001 --system app && \
    adduser --no-create-home --shell /bin/false --disabled-password --uid 1001 --system --group app

# Create necessary directories
RUN mkdir -p /app/models /app/uploads /app/results && \
    chown -R app:app /app

# Copy application files (including pre-cached model)
COPY --chown=app:app . .

# Verify model exists (should be pre-cached by build script)
RUN if [ ! -f /app/models/yolov5s.onnx ]; then \
        echo "⚠️  Model not found in build context - using mock detection"; \
        echo "Run 'scripts/cache-onnx-model.sh' before docker build"; \
    else \
        echo "✅ Using cached ONNX model: $(ls -lh /app/models/yolov5s.onnx)"; \
    fi

# Switch to app user
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["python", "app.py"]
