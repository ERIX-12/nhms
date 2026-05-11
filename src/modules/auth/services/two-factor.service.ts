import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../shared/logger/logger.service';
import * as authenticator from 'otplib/authenticator';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  generateSecret(userEmail: string): string {
    try {
      return authenticator.generateSecret({
        name: userEmail,
        issuer: 'NHMS',
        label: `NHMS (${userEmail})`,
      });
    } catch (error) {
      this.logger.error('Error generating 2FA secret', error);
      throw error;
    }
  }

  generateQRCode(secret: string, userEmail: string): string {
    try {
      const otpauthUrl = authenticator.keyuri(userEmail, 'NHMS', secret);
      return otpauthUrl;
    } catch (error) {
      this.logger.error('Error generating QR code', error);
      throw error;
    }
  }

  verifyToken(token: string, secret: string): boolean {
    try {
      return authenticator.verify({
        token,
        secret,
        window: 1, // Allow 1 step tolerance for time drift
      });
    } catch (error) {
      this.logger.error('Error verifying 2FA token', error);
      return false;
    }
  }

  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  async generateBackupCodesHash(codes: string[]): Promise<string[]> {
    const crypto = await import('crypto');
    return codes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );
  }

  async verifyBackupCode(code: string, hashedCodes: string[]): Promise<boolean> {
    const crypto = await import('crypto');
    const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
    return hashedCodes.includes(hashedInput);
  }
}
