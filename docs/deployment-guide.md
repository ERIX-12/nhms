# Deployment Guide - Nyaika Hotel Management System

## Overview

This guide provides comprehensive instructions for deploying the Nyaika Hotel Management System (NHMS) in various environments, from development to production.

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+

#### Recommended Production Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 100GB+ SSD
- **Network**: 1Gbps+ connection
- **Load Balancer**: NGINX / HAProxy

### Software Dependencies
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18+ (for local development)
- **PostgreSQL**: 15+ (if not using Docker)
- **Redis**: 7+ (if not using Docker)

## Environment Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Application
NODE_ENV=production
PORT=3001
API_PREFIX=api/v1

# Database
DATABASE_URL="postgresql://nhms_user:secure_password@postgres:5432/nhms"

# Redis
REDIS_URL="redis://redis:6379"

# JWT (Generate secure random strings)
JWT_SECRET=your-super-secure-jwt-secret-key-256-bits
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-256-bits
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@nyaikahotel.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Payment Gateways
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=live

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://yourdomain.com

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,doc,docx

# Monitoring
PROMETHEUS_PORT=9464
HEALTH_CHECK_INTERVAL=30000

# Hotel Configuration
HOTEL_NAME=Nyaika Hotel
HOTEL_EMAIL=info@nyaikahotel.com
HOTEL_PHONE=+256123456789
HOTEL_ADDRESS=123 Hotel Street, Kampala, Uganda

# Features
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=true
ENABLE_PUSH_NOTIFICATIONS=true
```

## Deployment Options

### Option 1: Docker Compose (Recommended for Small-Medium Deployments)

#### 1. Clone the Repository
```bash
git clone https://github.com/your-org/nhms.git
cd nhms
```

#### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your production values
```

#### 3. Deploy with Docker Compose
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f api
```

#### 4. Initialize Database
```bash
# Run database migrations
docker-compose exec api npx prisma migrate deploy

# Generate Prisma client
docker-compose exec api npx prisma generate

# Seed initial data (optional)
docker-compose exec api npx prisma db seed
```

#### 5. Verify Deployment
```bash
# Check API health
curl http://localhost:3001/health

# Access API documentation
open http://localhost:3001/api/v1/docs
```

### Option 2: Kubernetes (Recommended for Large-Scale Deployments)

#### 1. Prepare Kubernetes Manifests

Create namespace:
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nhms
```

#### 2. Deploy Database
```yaml
# postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: nhms
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: nhms
        - name: POSTGRES_USER
          value: nhms_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: nhms-secrets
              key: postgres-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: nhms
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

#### 3. Deploy Application
```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nhms-api
  namespace: nhms
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nhms-api
  template:
    metadata:
      labels:
        app: nhms-api
    spec:
      containers:
      - name: api
        image: ghcr.io/your-org/nhms:latest
        ports:
        - containerPort: 3001
        envFrom:
        - secretRef:
            name: nhms-secrets
        - configMapRef:
            name: nhms-config
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: nhms-api-service
  namespace: nhms
spec:
  selector:
    app: nhms-api
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
```

#### 4. Deploy Ingress
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nhms-ingress
  namespace: nhms
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.nyaikahotel.com
    secretName: nhms-tls
  rules:
  - host: api.nyaikahotel.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: nhms-api-service
            port:
              number: 3001
```

#### 5. Apply Manifests
```bash
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f api-deployment.yaml
kubectl apply -f ingress.yaml
```

### Option 3: Cloud Platform Deployment

#### AWS ECS

1. **Create ECR Repository**
```bash
aws ecr create-repository --repository-name nhms --region us-east-1
```

2. **Push Docker Image**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag nhms:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/nhms:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/nhms:latest
```

3. **Create ECS Task Definition**
```json
{
  "family": "nhms-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "nhms-api",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/nhms:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:nhms/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/nhms",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Google Cloud Run

1. **Build and Push Image**
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/nhms
```

2. **Deploy to Cloud Run**
```bash
gcloud run deploy nhms-api \
  --image gcr.io/PROJECT-ID/nhms \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=nhms-database-url:latest
```

#### Azure Container Instances

1. **Create Container Instance**
```bash
az container create \
  --resource-group nhms-rg \
  --name nhms-api \
  --image ghcr.io/your-org/nhms:latest \
  --cpu 2 \
  --memory 4 \
  --ports 3001 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables DATABASE_URL=$DATABASE_URL
```

## Database Setup

### PostgreSQL Configuration

#### 1. Install PostgreSQL (if not using Docker)
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 2. Create Database and User
```bash
sudo -u postgres psql
CREATE DATABASE nhms;
CREATE USER nhms_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE nhms TO nhms_user;
\q
```

#### 3. Configure PostgreSQL
```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Key settings:
listen_addresses = '*'
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB

# Edit pg_hba.conf for authentication
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add line for application access:
host    nhms    nhms_user    10.0.0.0/8    md5
```

#### 4. Restart PostgreSQL
```bash
sudo systemctl restart postgresql
```

### Redis Configuration

#### 1. Install Redis (if not using Docker)
```bash
# Ubuntu/Debian
sudo apt install redis-server

# CentOS/RHEL
sudo yum install redis
```

#### 2. Configure Redis
```bash
sudo nano /etc/redis/redis.conf

# Key settings:
bind 0.0.0.0
port 6379
requirepass your_redis_password
maxmemory 512mb
maxmemory-policy allkeys-lru
```

#### 3. Start Redis
```bash
sudo systemctl start redis
sudo systemctl enable redis
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

#### 1. Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

#### 2. Generate SSL Certificate
```bash
sudo certbot --nginx -d api.nyaikahotel.com -d www.nyaikahotel.com
```

#### 3. Auto-renewal
```bash
sudo crontab -e
# Add line:
0 12 * * * /usr/bin/certbot renew --quiet
```

### NGINX Configuration

Create `/etc/nginx/sites-available/nhms`:
```nginx
server {
    listen 80;
    server_name api.nyaikahotel.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.nyaikahotel.com;

    ssl_certificate /etc/letsencrypt/live/api.nyaikahotel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.nyaikahotel.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /var/www/nhms/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/nhms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring and Logging

### Prometheus Configuration

Create `/etc/prometheus/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'nhms-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']
```

### Grafana Dashboard

1. **Install Grafana**
```bash
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo apt update
sudo apt install grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

2. **Configure Data Source**
- Navigate to `http://localhost:3000`
- Add Prometheus data source: `http://localhost:9090`

### Log Management

#### Configure Winston Logs
```javascript
// Already configured in src/shared/logger/logger.service.ts
// Logs are stored in:
// - /var/log/nhms/combined-YYYY-MM-DD.log
// - /var/log/nhms/error-YYYY-MM-DD.log
```

#### Log Rotation
Create `/etc/logrotate.d/nhms`:
```
/var/log/nhms/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nhms-api
    endscript
}
```

## Backup Strategy

### Database Backups

#### Automated Backups
```bash
#!/bin/bash
# backup-db.sh
BACKUP_DIR="/var/backups/nhms"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/nhms_backup_$DATE.sql"

mkdir -p $BACKUP_DIR
pg_dump -h localhost -U nhms_user -d nhms > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove old backups (keep last 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_FILE.gz s3://your-backup-bucket/nhms/
```

Add to crontab:
```bash
# Daily at 2 AM
0 2 * * * /path/to/backup-db.sh
```

### File Backups

```bash
#!/bin/bash
# backup-files.sh
BACKUP_DIR="/var/backups/nhms"
DATE=$(date +%Y%m%d_%H%M%S)
FILES_DIR="/var/www/nhms/uploads"

tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz $FILES_DIR

# Remove old backups
find $BACKUP_DIR -name "uploads_backup_*.tar.gz" -mtime +30 -delete
```

## Security Hardening

### Firewall Configuration
```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001/tcp  # Restrict API access to localhost
```

### Security Headers
NGINX configuration addition:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

### Rate Limiting
```nginx
# In nginx.conf
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    server {
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://localhost:3001;
        }
    }
}
```

## Performance Optimization

### Database Optimization
```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_bookings_checkin_date ON bookings(check_in_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_rooms_hotel_status ON rooms(hotel_id, status);
CREATE INDEX idx_guests_email ON guests(email);

-- Analyze table statistics
ANALYZE;

-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Caching Strategy
```javascript
// Redis caching for frequently accessed data
// - Room availability (TTL: 5 minutes)
// - Hotel settings (TTL: 1 hour)
// - User sessions (TTL: 24 hours)
// - API responses (TTL: 1 minute)
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U nhms_user -d nhms

# View logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

#### 2. Redis Connection Failed
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping

# View logs
sudo tail -f /var/log/redis/redis-server.log
```

#### 3. Application Not Starting
```bash
# Check application logs
docker-compose logs api

# Check environment variables
docker-compose exec api env | grep -E "(DATABASE|REDIS|JWT)"

# Check port availability
netstat -tlnp | grep 3001
```

### Health Checks

```bash
# API Health Check
curl -f http://localhost:3001/health || echo "API unhealthy"

# Database Health Check
pg_isready -h localhost -p 5432 -U nhms_user

# Redis Health Check
redis-cli ping
```

## Maintenance

### Regular Maintenance Tasks

#### Weekly
- Review application logs for errors
- Check disk space usage
- Monitor performance metrics
- Update security patches

#### Monthly
- Database maintenance (VACUUM, ANALYZE)
- Review and rotate secrets
- Backup verification
- Performance tuning

#### Quarterly
- Security audit
- Disaster recovery testing
- Capacity planning
- Software updates

### Rolling Updates

```bash
# Zero-downtime deployment with Docker Compose
docker-compose up -d --no-deps api --scale api=2
# Wait for new containers to be healthy
docker-compose up -d --no-deps api --scale api=1
```

This deployment guide provides comprehensive instructions for deploying NHMS in various environments. Choose the deployment option that best fits your infrastructure requirements and scale.
