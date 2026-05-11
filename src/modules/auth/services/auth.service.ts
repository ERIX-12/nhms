import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { LoggerService } from '../../../shared/logger/logger.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { User, Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly twoFactorService: TwoFactorService,
    private readonly logger: LoggerService,
    private readonly auditService: AuditService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          role: true,
          hotel: true,
        },
      });

      if (!user) {
        this.logger.warn(`Login attempt with non-existent email: ${email}`);
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password attempt for email: ${email}`);
        return null;
      }

      if (!user.isActive) {
        this.logger.warn(`Login attempt for inactive user: ${email}`);
        throw new UnauthorizedException('Account is deactivated');
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return user;
    } catch (error) {
      this.logger.error('Error validating user', error);
      throw error;
    }
  }

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    try {
      // Validate user credentials
      const user = await this.validateUser(loginDto.email, loginDto.password);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!loginDto.twoFactorCode) {
          throw new BadRequestException('Two-factor authentication code required');
        }

        const isValid2FA = await this.twoFactorService.verifyToken(
          loginDto.twoFactorCode,
          user.twoFactorSecret!,
        );

        if (!isValid2FA) {
          throw new UnauthorizedException('Invalid two-factor code');
        }
      }

      // Generate tokens
      const tokens = await this.tokenService.generateTokens(user);

      // Create session
      await this.tokenService.createSession(user.id, tokens.accessToken, ipAddress, userAgent);

      // Log successful login
      await this.auditService.logAction({
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        ipAddress,
        userAgent,
        newValues: { loginTime: new Date() },
      });

      this.logger.logAuthEvent('USER_LOGIN', user.id, {
        ipAddress,
        userAgent,
      });

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Login error', error);
      throw error;
    }
  }

  async register(registerDto: RegisterDto, ipAddress: string, userAgent: string) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        registerDto.password,
        this.configService.get<number>('security.bcryptRounds') || 12,
      );

      // Get default role (GUEST)
      const guestRole = await this.prisma.role.findUnique({
        where: { name: 'GUEST' },
      });

      if (!guestRole) {
        throw new Error('Default GUEST role not found');
      }

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          phone: registerDto.phone,
          hotelId: registerDto.hotelId,
          roleId: guestRole.id,
        },
        include: {
          role: true,
          hotel: true,
        },
      });

      // Generate tokens
      const tokens = await this.tokenService.generateTokens(user);

      // Create session
      await this.tokenService.createSession(user.id, tokens.accessToken, ipAddress, userAgent);

      // Log registration
      await this.auditService.logAction({
        action: 'USER_REGISTER',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        ipAddress,
        userAgent,
        newValues: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });

      this.logger.logAuthEvent('USER_REGISTER', user.id, {
        ipAddress,
        userAgent,
      });

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Registration error', error);
      throw error;
    }
  }

  async logout(userId: string, token: string) {
    try {
      // Revoke token
      await this.tokenService.revokeToken(token);

      // Log logout
      await this.auditService.logAction({
        action: 'USER_LOGOUT',
        entity: 'User',
        entityId: userId,
        userId,
        newValues: { logoutTime: new Date() },
      });

      this.logger.logAuthEvent('USER_LOGOUT', userId);

      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error('Logout error', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      if (!payload) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token is revoked
      const isRevoked = await this.tokenService.isTokenRevoked(refreshToken);
      if (isRevoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          role: true,
          hotel: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new tokens
      const tokens = await this.tokenService.generateTokens(user);

      // Revoke old refresh token
      await this.tokenService.revokeToken(refreshToken);

      return tokens;
    } catch (error) {
      this.logger.error('Refresh token error', error);
      throw error;
    }
  }

  async enable2FA(userId: string, secret: string, code: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify the code
      const isValid = await this.twoFactorService.verifyToken(code, secret);
      if (!isValid) {
        throw new BadRequestException('Invalid verification code');
      }

      // Enable 2FA for user
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: secret,
          twoFactorEnabled: true,
        },
      });

      // Log 2FA enablement
      await this.auditService.logAction({
        action: '2FA_ENABLED',
        entity: 'User',
        entityId: userId,
        userId,
        newValues: { twoFactorEnabled: true },
      });

      this.logger.logAuthEvent('2FA_ENABLED', userId);

      return { message: 'Two-factor authentication enabled successfully' };
    } catch (error) {
      this.logger.error('Enable 2FA error', error);
      throw error;
    }
  }

  async disable2FA(userId: string, code: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.twoFactorEnabled) {
        throw new BadRequestException('Two-factor authentication is not enabled');
      }

      // Verify the code
      const isValid = await this.twoFactorService.verifyToken(
        code,
        user.twoFactorSecret!,
      );
      if (!isValid) {
        throw new BadRequestException('Invalid verification code');
      }

      // Disable 2FA for user
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: null,
          twoFactorEnabled: false,
        },
      });

      // Log 2FA disablement
      await this.auditService.logAction({
        action: '2FA_DISABLED',
        entity: 'User',
        entityId: userId,
        userId,
        newValues: { twoFactorEnabled: false },
      });

      this.logger.logAuthEvent('2FA_DISABLED', userId);

      return { message: 'Two-factor authentication disabled successfully' };
    } catch (error) {
      this.logger.error('Disable 2FA error', error);
      throw error;
    }
  }

  async forgotPassword(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists or not
        return { message: 'If an account exists with this email, a password reset link has been sent' };
      }

      // Generate reset token
      const resetToken = await this.tokenService.generatePasswordResetToken(user.id);

      // TODO: Send email with reset token
      // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

      // Log password reset request
      await this.auditService.logAction({
        action: 'PASSWORD_RESET_REQUEST',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        newValues: { resetRequestedAt: new Date() },
      });

      this.logger.logAuthEvent('PASSWORD_RESET_REQUEST', user.id);

      return { message: 'If an account exists with this email, a password reset link has been sent' };
    } catch (error) {
      this.logger.error('Forgot password error', error);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      // Verify reset token
      const payload = this.tokenService.verifyPasswordResetToken(token);
      if (!payload) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Check if token is used
      const isUsed = await this.tokenService.isPasswordResetTokenUsed(token);
      if (isUsed) {
        throw new BadRequestException('Reset token has already been used');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(
        newPassword,
        this.configService.get<number>('security.bcryptRounds') || 12,
      );

      // Update user password
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      // Mark token as used
      await this.tokenService.markPasswordResetTokenAsUsed(token);

      // Log password reset
      await this.auditService.logAction({
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: payload.sub,
        userId: payload.sub,
        newValues: { passwordResetAt: new Date() },
      });

      this.logger.logAuthEvent('PASSWORD_RESET', payload.sub);

      return { message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error('Reset password error', error);
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(
        newPassword,
        this.configService.get<number>('security.bcryptRounds') || 12,
      );

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Log password change
      await this.auditService.logAction({
        action: 'PASSWORD_CHANGED',
        entity: 'User',
        entityId: userId,
        userId,
        newValues: { passwordChangedAt: new Date() },
      });

      this.logger.logAuthEvent('PASSWORD_CHANGED', userId);

      return { message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error('Change password error', error);
      throw error;
    }
  }

  private sanitizeUser(user: User & { role: Role; hotel: any }) {
    const { password, twoFactorSecret, passwordResetToken, passwordResetExpires, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
