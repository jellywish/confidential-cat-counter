FROM node:18.17.0-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Create app user
RUN addgroup -g 1001 -S app && \
    adduser -S app -u 1001

# Create necessary directories
RUN mkdir -p uploads public && \
    chown -R app:app /app

# Copy application files
COPY --chown=app:app . .

# Switch to app user
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]
