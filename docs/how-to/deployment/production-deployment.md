# Production Deployment Guide

This guide covers deploying the Confidential Cat Counter in production environments with security, scalability, and reliability considerations.

## Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │     Firewall    │    │   Monitoring    │
│   (Nginx/HAP)   │    │   (iptables/    │    │  (Prometheus/   │
│                 │    │    CloudFlare)  │    │    Grafana)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Swarm / Kubernetes                │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   Web Client    │   Web Client    │   ML Service    │   Redis   │
│   (Replica 1)   │   (Replica 2)   │   (Primary)     │ (Primary) │
│                 │                 │                 │           │
│ • TLS Termination│ • Session Affinity│ • GPU Access  │ • Backup │
│ • Rate Limiting │ • Health Checks │ • Model Cache   │ • Cluster │
│ • CORS Config   │ • Auto-scaling  │ • Queue Worker  │ • Persist │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

## Container Orchestration

### Docker Compose (Recommended for Small-Scale)

**Production docker-compose.yml:**
```yaml
version: '3.8'

services:
  web-client-1:
    build: ./src/web-client
    container_name: ccc-web-1
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - ML_SERVICE_URL=http://ml-service:8000
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
      - RATE_LIMIT_WINDOW=${RATE_LIMIT_WINDOW:-900000}
      - RATE_LIMIT_MAX=${RATE_LIMIT_MAX:-100}
      - LOG_LEVEL=info
    ports:
      - "3000:3000"
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - ccc-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  web-client-2:
    build: ./src/web-client
    container_name: ccc-web-2
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - ML_SERVICE_URL=http://ml-service:8000
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
      - RATE_LIMIT_WINDOW=${RATE_LIMIT_WINDOW:-900000}
      - RATE_LIMIT_MAX=${RATE_LIMIT_MAX:-100}
      - LOG_LEVEL=info
    ports:
      - "3001:3000"
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - ccc-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  ml-service:
    build: ./src/ml-service
    container_name: ccc-ml-service
    restart: unless-stopped
    environment:
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
      - CONFIDENCE_THRESHOLD=${CONFIDENCE_THRESHOLD:-0.5}
      - MODEL_PRIORITY=${MODEL_PRIORITY:-yolo-nas,yolov5l,yolov11m,yolov8m,yolov5s}
    ports:
      - "8000:8000"
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./models:/app/models
      - ./logs:/app/logs
    networks:
      - ccc-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  redis:
    image: redis:7-alpine
    container_name: ccc-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    networks:
      - ccc-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: ccc-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - web-client-1
      - web-client-2
    networks:
      - ccc-network

volumes:
  redis_data:
    driver: local

networks:
  ccc-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Kubernetes (Recommended for Large-Scale)

**Kubernetes manifests:**

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: confidential-cat-counter
  labels:
    app: ccc
---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ccc-config
  namespace: confidential-cat-counter
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  RATE_LIMIT_WINDOW: "900000"
  RATE_LIMIT_MAX: "100"
  CONFIDENCE_THRESHOLD: "0.5"
---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ccc-secrets
  namespace: confidential-cat-counter
type: Opaque
data:
  REDIS_PASSWORD: <base64-encoded-password>
  ALLOWED_ORIGINS: <base64-encoded-origins>
---
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: confidential-cat-counter
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server", "--appendonly", "yes"]
        ports:
        - containerPort: 6379
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ccc-secrets
              key: REDIS_PASSWORD
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
---
# web-client-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-client
  namespace: confidential-cat-counter
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-client
  template:
    metadata:
      labels:
        app: web-client
    spec:
      containers:
      - name: web-client
        image: confidential-cat-counter/web-client:latest
        ports:
        - containerPort: 3000
        env:
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: ML_SERVICE_URL
          value: "http://ml-service:8000"
        envFrom:
        - configMapRef:
            name: ccc-config
        - secretRef:
            name: ccc-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Security Configuration

### TLS/SSL Setup

**Nginx TLS Configuration:**
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream web_backend {
        server web-client-1:3000;
        server web-client-2:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;
    
    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 10M;

        location / {
            proxy_pass http://web_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /upload {
            limit_req zone=upload burst=5 nodelay;
            proxy_pass http://web_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Firewall Configuration

**UFW (Ubuntu) Setup:**
```bash
# Reset firewall
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH access
sudo ufw allow ssh

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Internal services (restrict to Docker network)
sudo ufw allow from 172.20.0.0/16 to any port 3000
sudo ufw allow from 172.20.0.0/16 to any port 8000
sudo ufw allow from 172.20.0.0/16 to any port 6379

# Enable firewall
sudo ufw enable
```

**iptables Rules:**
```bash
# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Rate limit connections
iptables -A INPUT -p tcp --dport 80 -m limit --limit 10/minute -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -m limit --limit 10/minute -j ACCEPT

# Drop everything else
iptables -A INPUT -j DROP
```

## Environment Configuration

### Production Environment Variables

**Web Client (.env.production):**
```bash
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your-secure-redis-password

# ML Service Configuration
ML_SERVICE_URL=http://ml-service:8000

# Security Configuration
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
RATE_LIMIT_WINDOW=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX=100        # requests per window

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/app/logs/web-client.log

# Upload Configuration
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760    # 10MB in bytes

# Session Configuration
SESSION_SECRET=your-session-secret-key
SESSION_TIMEOUT=3600      # 1 hour in seconds
```

**ML Service (.env.production):**
```bash
# Server Configuration
HOST=0.0.0.0
PORT=8000

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your-secure-redis-password

# Model Configuration
MODEL_PRIORITY=yolo-nas,yolov5l,yolov11m,yolov8m,yolov5s
CONFIDENCE_THRESHOLD=0.5
MODEL_CACHE_DIR=/app/models

# Processing Configuration
MAX_CONCURRENT_JOBS=4
PROCESSING_TIMEOUT=30     # seconds
QUEUE_POLL_INTERVAL=1     # seconds

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/app/logs/ml-service.log

# Resource Limits
MAX_MEMORY_USAGE=3000     # MB
MAX_CPU_CORES=2
```

### Secrets Management

**Using Docker Secrets:**
```bash
# Create secrets
echo "your-redis-password" | docker secret create redis_password -
echo "https://your-domain.com" | docker secret create allowed_origins -

# Update docker-compose.yml
services:
  web-client:
    secrets:
      - redis_password
      - allowed_origins
    environment:
      - REDIS_PASSWORD_FILE=/run/secrets/redis_password
      - ALLOWED_ORIGINS_FILE=/run/secrets/allowed_origins

secrets:
  redis_password:
    external: true
  allowed_origins:
    external: true
```

**Using Kubernetes Secrets:**
```bash
# Create secrets
kubectl create secret generic ccc-secrets \
  --from-literal=REDIS_PASSWORD=your-redis-password \
  --from-literal=ALLOWED_ORIGINS=https://your-domain.com \
  -n confidential-cat-counter
```

## Monitoring and Logging

### Prometheus Configuration

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'web-client'
    static_configs:
      - targets: ['web-client-1:3000', 'web-client-2:3000']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'ml-service'
    static_configs:
      - targets: ['ml-service:8000']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']
    metrics_path: /metrics
    scrape_interval: 30s
```

### Centralized Logging

**ELK Stack Configuration:**
```yaml
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "web-client" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
    }
    json {
      source => "message"
    }
  }

  if [fields][service] == "ml-service" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "confidential-cat-counter-%{+YYYY.MM.dd}"
  }
}
```

### Health Monitoring

**Docker Healthcheck Script:**
```bash
#!/bin/bash
# healthcheck.sh

# Check web client health
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Web client health check failed"
    exit 1
fi

# Check ML service health
if ! curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "ML service health check failed"
    exit 1
fi

# Check Redis connectivity
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Redis health check failed"
    exit 1
fi

echo "All services healthy"
exit 0
```

## Backup and Recovery

### Redis Backup Strategy

**Automated Backup Script:**
```bash
#!/bin/bash
# redis-backup.sh

BACKUP_DIR="/opt/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
REDIS_HOST="localhost"
REDIS_PORT="6379"
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# Create Redis backup
redis-cli -h $REDIS_HOST -p $REDIS_PORT --rdb $BACKUP_DIR/dump_$DATE.rdb

# Compress backup
gzip $BACKUP_DIR/dump_$DATE.rdb

# Remove old backups
find $BACKUP_DIR -name "*.rdb.gz" -mtime +$RETENTION_DAYS -delete

# Log backup completion
echo "$(date): Redis backup completed - dump_$DATE.rdb.gz" >> /var/log/redis-backup.log
```

**Cron Job Setup:**
```bash
# Add to crontab
0 2 * * * /opt/scripts/redis-backup.sh

# Backup job logs
0 2 * * * /opt/scripts/redis-backup.sh >> /var/log/cron.log 2>&1
```

### Application Data Backup

**File Upload Backup:**
```bash
#!/bin/bash
# uploads-backup.sh

UPLOAD_DIR="/opt/ccc/uploads"
BACKUP_DIR="/opt/backups/uploads"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $UPLOAD_DIR .

# Remove old backups
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "$(date): Uploads backup completed - uploads_$DATE.tar.gz"
```

## Performance Optimization

### Resource Allocation

**Docker Resource Limits:**
```yaml
services:
  web-client:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  ml-service:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
        reservations:
          cpus: '2'
          memory: 2G

  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

### Caching Strategy

**Redis Caching Configuration:**
```bash
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Auto-scaling Configuration

**Kubernetes HPA:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-client-hpa
  namespace: confidential-cat-counter
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-client
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Disaster Recovery

### Recovery Procedures

**Service Recovery Playbook:**

1. **Complete System Failure:**
```bash
# Stop all services
docker-compose down

# Restore from backup
./restore-from-backup.sh latest

# Start services
docker-compose up -d

# Verify health
./healthcheck.sh
```

2. **Database Recovery:**
```bash
# Stop Redis
docker-compose stop redis

# Restore Redis data
gunzip -c /opt/backups/redis/dump_latest.rdb.gz > /opt/ccc/redis/dump.rdb

# Start Redis
docker-compose start redis

# Verify data integrity
redis-cli info replication
```

3. **Rolling Update:**
```bash
# Update with zero downtime
docker-compose up -d --no-deps web-client-1
sleep 30
docker-compose up -d --no-deps web-client-2
sleep 30
docker-compose up -d --no-deps ml-service
```

## Security Checklist

### Pre-deployment Security Review

- [ ] **Secrets Management**
  - [ ] No hardcoded secrets in code
  - [ ] Proper secret rotation strategy
  - [ ] Encrypted secrets at rest

- [ ] **Network Security**
  - [ ] TLS 1.2+ enforced
  - [ ] Firewall rules configured
  - [ ] Internal network isolation

- [ ] **Container Security**
  - [ ] Non-root user in containers
  - [ ] Read-only root filesystem where possible
  - [ ] Security scanning of container images

- [ ] **Access Control**
  - [ ] Principle of least privilege
  - [ ] Regular access review
  - [ ] Strong authentication mechanisms

- [ ] **Monitoring**
  - [ ] Security event logging
  - [ ] Anomaly detection
  - [ ] Incident response procedures

### Compliance Considerations

**GDPR Compliance:**
- Data minimization implemented
- Right to erasure supported
- Data processing lawful basis documented
- Privacy by design architecture

**SOC 2 Considerations:**
- Audit logging implemented
- Access controls documented
- Change management processes
- Incident response procedures

## Troubleshooting

### Common Production Issues

**High Memory Usage:**
```bash
# Check container memory usage
docker stats

# Check Redis memory usage
redis-cli info memory

# Adjust Redis memory limits
redis-cli config set maxmemory 256mb
```

**Performance Degradation:**
```bash
# Check system resources
htop
iotop

# Check application logs
docker logs ccc-web-client
docker logs ccc-ml-service

# Check Redis performance
redis-cli info stats
```

**Connection Issues:**
```bash
# Test network connectivity
docker exec ccc-web-client ping redis
docker exec ccc-web-client ping ml-service

# Check port availability
netstat -tlnp | grep 3000
netstat -tlnp | grep 8000
netstat -tlnp | grep 6379
```

This production deployment guide provides a comprehensive foundation for deploying the Confidential Cat Counter in production environments with proper security, monitoring, and reliability considerations.
