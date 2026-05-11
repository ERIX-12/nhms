import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { User } from '@prisma/client';
import { LoggerService } from '../../../shared/logger/logger.service';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async generateTokens(user: User & { role: any; hotel: any }) {
    const payload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      hotelId: user.hotelId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('jwt.expiresIn') || '24h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') || '7d',
    });

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.expiresIn') || '24h',
    };
  }

  async createSession(userId: string, token: string, ipAddress: string, userAgent: string) {
    try {
      await this.prisma.userSession.create({
        data: {
          token: crypto.createHash('sha256').update(token).digest('hex'),
          userId,
          ipAddress,
          userAgent,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
    } catch (error) {
      this.logger.error('Error creating session', error);
    }
  }

  async revokeToken(token: string) {
    try {
      // Revoke refresh token
      await this.prisma.refreshToken.updateMany({
        where: { token },
        data: { isRevoked: true },
      });

      // Remove session
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      await this.prisma.userSession.deleteMany({
        where: { token: hashedToken },
      });
    } catch (error) {
      this.logger.error('Error revoking token', error);
    }
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      const refreshToken = await this.prisma.refreshToken.findUnique({
        where: { token },
      });

      if (!refreshToken) {
        return true;
      }

      return refreshToken.isRevoked || refreshToken.expiresAt < new Date();
    } catch (error) {
      this.logger.error('Error checking token revocation', error);
      return true;
    }
  }

  verifyRefreshToken(token: string): any {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch (error) {
      return null;
    }
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      },
    });

    return token;
  }

  async verifyPasswordResetToken(token: string): any {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return null;
      }

      return { sub: user.id, email: user.email };
    } catch (error) {
      this.logger.error('Error verifying password reset token', error);
      return null;
    }
  }

  async isPasswordResetTokenUsed(token: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          passwordResetToken: token,
        },
      });

      if (!user) {
        return true;
      }

      return !user.passwordResetToken || user.passwordResetExpires < new Date();
    } catch (error) {
      this.logger.error('Error checking password reset token usage', error);
      return true;
    }
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    try {
      await this.prisma.user.updateMany({
        where: { passwordResetToken: token },
        data: {
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
    } catch (error) {
      this.logger.error('Error marking password reset token as used', error);
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      // Clean up expired refresh tokens
      await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { isRevoked: true },
            { expiresAt: { lt: new Date() } },
          ],
        },
      });

      // Clean up expired sessions
      await this.prisma.userSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      this.logger.log('Cleaned up expired tokens and sessions');
    } catch (error) {
      this.logger.error('Error cleaning up expired tokens', error);
    }
  }
}
