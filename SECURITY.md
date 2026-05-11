# Security Documentation - Nyaika Hotel Management System

## Overview

This document outlines the security measures implemented in the Nyaika Hotel Management System (NHMS) and provides guidelines for maintaining a secure deployment.

## Security Architecture

### Defense in Depth

NHMS implements a multi-layered security approach:

1. **Network Security**: Firewalls, SSL/TLS, DDoS protection
2. **Application Security**: Authentication, authorization, input validation
3. **Data Security**: Encryption, access controls, audit logging
4. **Infrastructure Security**: Container security, secrets management
5. **Operational Security**: Monitoring, incident response, compliance

## Authentication & Authorization

### JWT Authentication

#### Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "email": "user@example.com",
    "role": "RECEPTIONIST",
    "hotelId": "hotel_id",
    "iat": 1642248600,
    "exp": 1642335000
  }
}
```

#### Security Measures
- **Secret Key Management**: 256-bit keys stored in environment variables
- **Token Expiration**: Access tokens (24h), Refresh tokens (7d)
- **Token Rotation**: Automatic refresh token rotation
- **Blacklisting**: Revoked tokens stored in Redis

#### Implementation
```typescript
// JWT Configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET, // Must be 256+ bits
  expiresIn: '24h',
  algorithm: 'HS256',
  issuer: 'nhms',
  audience: 'nhms-users'
};

// Token validation middleware
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Token not provided');
    }
    
    return this.validateToken(token);
  }
}
```

### Role-Based Access Control (RBAC)

#### Role Hierarchy
```
ADMIN
├── MANAGER
│   ├── RECEPTIONIST
│   └── ACCOUNTANT
├── HOUSEKEEPER
└── GUEST
```

#### Permission Matrix
| Role | Hotels | Rooms | Bookings | Payments | Reports | Settings |
|------|--------|-------|----------|----------|---------|----------|
| ADMIN | Full | Full | Full | Full | Full | Full |
| MANAGER | Full | Full | Full | Full | Full | Limited |
| RECEPTIONIST | Read | Full | Full | Limited | Read | None |
| ACCOUNTANT | Read | Read | Read | Full | Full | None |
| HOUSEKEEPER | Read | Read | Read | None | None | None |
| GUEST | None | Read | Own | Own | None | None |

#### Implementation
```typescript
@Roles(Role.ADMIN, Role.MANAGER)
@Get('/hotels')
async getHotels() {
  // Only admins and managers can access
}

@Permissions(Permission.CREATE_BOOKING)
@Post('/bookings')
async createBooking() {
  // Users with CREATE_BOOKING permission
}
```

### Multi-Factor Authentication (MFA)

#### TOTP Implementation
- **Algorithm**: HMAC-SHA1
- **Digits**: 6
- **Period**: 30 seconds
- **Backup Codes**: 10 one-time codes

```typescript
@Injectable()
export class TwoFactorService {
  generateSecret(userEmail: string): string {
    return authenticator.generateSecret({
      name: userEmail,
      issuer: 'NHMS',
      label: 'NHMS'
    });
  }
  
  verifyToken(token: string, secret: string): boolean {
    return authenticator.verify({
      token,
      secret,
      window: 1 // Allow 1 step tolerance
    });
  }
}
```

## Data Protection

### Encryption at Rest

#### Database Encryption
```sql
-- Enable transparent data encryption (PostgreSQL)
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/path/to/server.crt';
ALTER SYSTEM SET ssl_key_file = '/path/to/server.key';

-- Column-level encryption for sensitive data
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt guest PII
UPDATE guests SET 
  national_id = crypt(national_id, gen_salt('bf')),
  passport = crypt(passport, gen_salt('bf'));
```

#### File Storage Encryption
```typescript
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex')
    };
  }
}
```

### Encryption in Transit

#### TLS Configuration
```nginx
# Strong TLS configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Certificate pinning (optional)
add_header Public-Key-Pins 'pin-sha256="base64+primary=="; pin-sha256="base64+backup=="; max-age=5184000; includeSubDomains' always;
```

#### API Security Headers
```typescript
@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const response = context.switchToHttp().getResponse();
    
    // Security headers
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Content-Security-Policy', this.getCSP());
    
    return next.handle();
  }
  
  private getCSP(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'"
    ].join('; ');
  }
}
```

## Input Validation & Sanitization

### Request Validation
```typescript
// DTO with validation decorators
export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  guestId: string;
  
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]\d{3}$/, { message: 'Room number must be in format A123' })
  roomId: string;
  
  @IsDateString()
  @IsFutureDate()
  checkInDate: string;
  
  @IsDateString()
  @IsDateAfter('checkInDate')
  checkOutDate: string;
  
  @IsInt()
  @Min(1)
  @Max(10)
  adultsCount: number;
  
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeHtml()
  specialRequests?: string;
}
```

### SQL Injection Prevention
```typescript
// Using Prisma ORM (parameterized queries by default)
async getBookingsByDate(startDate: Date, endDate: Date) {
  return this.prisma.booking.findMany({
    where: {
      checkInDate: {
        gte: startDate
      },
      checkOutDate: {
        lte: endDate
      }
    }
  });
}

// Raw queries with parameter binding
async getCustomReport(sql: string, params: any[]) {
  return this.prisma.$queryRawUnsafe(sql, ...params);
}
```

### XSS Prevention
```typescript
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

@Injectable()
export class SanitizationService {
  private window = new JSDOM('').window;
  private DOMPurify = DOMPurify(this.window);
  
  sanitizeHtml(dirty: string): string {
    return this.DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
      ALLOWED_ATTR: []
    });
  }
  
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .trim()
      .substring(0, 1000); // Limit length
  }
}
```

## API Security

### Rate Limiting
```typescript
// Global rate limiting
@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }])
  ]
})

// Endpoint-specific rate limiting
@Throttle(10, 60) // 10 requests per minute
@Post('/auth/login')
async login() {
  // Login endpoint
}

@Throttle(5, 300) // 5 requests per 5 minutes
@Post('/auth/forgot-password')
async forgotPassword() {
  // Password reset endpoint
}
```

### API Key Management
```typescript
@Injectable()
export class ApiKeyService {
  async generateApiKey(userId: string, permissions: string[]): Promise<string> {
    const key = crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    
    await this.prisma.apiKey.create({
      data: {
        userId,
        hashedKey,
        permissions,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });
    
    return key;
  }
  
  async validateApiKey(key: string): Promise<boolean> {
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { hashedKey, isActive: true }
    });
    
    return apiKey && apiKey.expiresAt > new Date();
  }
}
```

### Webhook Security
```typescript
@Injectable()
export class WebhookService {
  verifyWebhook(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
```

## Infrastructure Security

### Container Security

#### Docker Security
```dockerfile
# Use non-root user
FROM node:18-alpine AS base
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Minimal base image
FROM node:18-alpine AS runner
RUN apk add --no-cache dumb-init

# Security scanning
RUN npm audit --audit-level high
```

#### Kubernetes Security
```yaml
# Pod Security Context
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
  containers:
  - name: api
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: uploads
      mountPath: /app/uploads
  volumes:
  - name: tmp
    emptyDir: {}
  - name: uploads
    persistentVolumeClaim:
      claimName: uploads-pvc
```

### Network Security

#### Firewall Rules
```bash
# UFW Configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Database access from application servers only
sudo ufw allow from 10.0.0.0/8 to any port 5432
sudo ufw allow from 10.0.0.0/8 to any port 6379

# Deny direct API access
sudo ufw deny 3001/tcp
```

#### VPN Configuration
```bash
# WireGuard setup for secure admin access
sudo apt install wireguard

# Generate keys
wg genkey | sudo tee /etc/wireguard/private.key
sudo chmod 600 /etc/wireguard/private.key
sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key
```

## Monitoring & Logging

### Security Monitoring
```typescript
@Injectable()
export class SecurityMonitor {
  constructor(private readonly logger: LoggerService) {}
  
  logSecurityEvent(event: SecurityEvent) {
    this.logger.logSecurityEvent(event.type, {
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      timestamp: new Date(),
      severity: event.severity
    });
  }
  
  async detectAnomalies(userId: string): Promise<boolean> {
    const recentLogins = await this.getRecentLogins(userId, 24); // Last 24 hours
    const uniqueIPs = new Set(recentLogins.map(login => login.ipAddress));
    
    // Flag if more than 3 different IPs in 24 hours
    if (uniqueIPs.size > 3) {
      this.logSecurityEvent({
        type: 'SUSPICIOUS_LOGIN_PATTERN',
        userId,
        severity: 'HIGH'
      });
      return true;
    }
    
    return false;
  }
}
```

### Audit Logging
```typescript
@Injectable()
export class AuditService {
  async logAction(action: AuditAction) {
    await this.prisma.auditLog.create({
      data: {
        action: action.type,
        entity: action.entity,
        entityId: action.entityId,
        oldValues: action.oldValues,
        newValues: action.newValues,
        userId: action.userId,
        ipAddress: action.ipAddress,
        userAgent: action.userAgent
      }
    });
  }
}
```

## Compliance

### GDPR Compliance

#### Data Subject Rights
```typescript
@Injectable()
export class GdprService {
  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const bookings = await this.prisma.booking.findMany({ where: { userId } });
    const payments = await this.prisma.payment.findMany({ where: { booking: { userId } } });
    
    return {
      personalData: user,
      bookingHistory: bookings,
      paymentHistory: payments,
      exportDate: new Date()
    };
  }
  
  async deleteUserData(userId: string): Promise<void> {
    // Anonymize instead of delete for audit purposes
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${Date.now()}@deleted.com`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        isActive: false
      }
    });
  }
}
```

#### Data Processing Agreement
- All data processing activities are logged
- Data retention policies implemented
- Cross-border data transfers compliant with GDPR
- Privacy by design principles applied

### PCI DSS Compliance

#### Payment Security
```typescript
@Injectable()
export class PaymentSecurityService {
  // Never store raw card details
  async processPayment(paymentData: PaymentDto): Promise<PaymentResult> {
    // Tokenize card details
    const token = await this.stripe.tokens.create({
      card: {
        number: paymentData.cardNumber,
        exp_month: paymentData.expiryMonth,
        exp_year: paymentData.expiryYear,
        cvc: paymentData.cvc
      }
    });
    
    // Process payment with token only
    const charge = await this.stripe.charges.create({
      amount: paymentData.amount,
      currency: 'usd',
      source: token.id,
      description: `Booking ${paymentData.bookingId}`
    });
    
    return {
      success: true,
      chargeId: charge.id,
      amount: charge.amount
    };
  }
}
```

## Incident Response

### Security Incident Procedure

1. **Detection**
   - Automated monitoring alerts
   - Manual security reviews
   - User reports

2. **Assessment**
   - Determine scope and impact
   - Classify incident severity
   - Initiate response team

3. **Containment**
   - Isolate affected systems
   - Block malicious IPs
   - Disable compromised accounts

4. **Eradication**
   - Remove malware/backdoors
   - Patch vulnerabilities
   - Update security controls

5. **Recovery**
   - Restore from clean backups
   - Verify system integrity
   - Monitor for recurrence

6. **Lessons Learned**
   - Document incident timeline
   - Analyze root cause
   - Update security policies

### Security Checklist

#### Daily
- [ ] Review security logs for anomalies
- [ ] Monitor failed login attempts
- [ ] Check for security updates

#### Weekly
- [ ] Review access logs
- [ ] Scan for vulnerabilities
- [ ] Backup verification

#### Monthly
- [ ] Security audit
- [ ] Penetration testing
- [ ] Policy review

#### Quarterly
- [ ] Security training
- [ ] Incident response drill
- [ ] Compliance assessment

## Best Practices

### Development Security
1. **Secure Coding Standards**
   - Input validation
   - Error handling
   - Secure dependencies

2. **Code Review Process**
   - Security-focused reviews
   - Automated security scanning
   - Manual penetration testing

3. **Dependency Management**
   - Regular vulnerability scanning
   - Automated updates
   - License compliance

### Operational Security
1. **Access Control**
   - Principle of least privilege
   - Regular access reviews
   - Multi-factor authentication

2. **Backup Security**
   - Encrypted backups
   - Off-site storage
   - Regular restoration tests

3. **Disaster Recovery**
   - documented procedures
   - Regular testing
   - Clear communication plan

This security documentation provides comprehensive guidelines for maintaining the security of the NHMS. Regular security reviews and updates are essential to protect against evolving threats.
