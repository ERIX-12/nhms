import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  
  // Email
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
  },
  
  // SMS (Twilio)
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  
  // Payment Gateways
  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox',
    },
  },
  
  // File Upload
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs',
  },
  
  // Monitoring
  monitoring: {
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT, 10) || 9464,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
  },
  
  // Queue
  queue: {
    redisHost: process.env.QUEUE_REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.QUEUE_REDIS_PORT, 10) || 6379,
    redisPassword: process.env.QUEUE_REDIS_PASSWORD,
  },
  
  // Frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
    webUrl: process.env.WEB_URL || 'http://localhost:3000',
  },
  
  // Hotel Configuration
  hotel: {
    name: process.env.HOTEL_NAME || 'Nyaika Hotel',
    email: process.env.HOTEL_EMAIL || 'info@nyaikahotel.com',
    phone: process.env.HOTEL_PHONE || '+256123456789',
    address: process.env.HOTEL_ADDRESS || '123 Hotel Street, Kampala, Uganda',
  },
  
  // Features
  features: {
    emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    smsNotifications: process.env.ENABLE_SMS_NOTIFICATIONS === 'true',
    pushNotifications: process.env.ENABLE_PUSH_NOTIFICATIONS === 'true',
    whatsappNotifications: process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true',
  },
  
  // Development
  debug: process.env.DEBUG === 'true',
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
}));
