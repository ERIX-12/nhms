import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Response,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { TwoFactorService } from '../services/two-factor.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthGuard } from '../guards/auth.guard';
import { Public } from '../decorators/public.decorator';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ) {
    const result = await this.authService.login(
      loginDto,
      req.ip,
      req.get('User-Agent'),
    );
    
    // Set refresh token in HTTP-only cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
    };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ) {
    const result = await this.authService.register(
      registerDto,
      req.ip,
      req.get('User-Agent'),
    );

    // Set refresh token in HTTP-only cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      statusCode: 201,
      message: 'Registration successful',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ) {
    const user = req.user as any;
    const refreshToken = req.cookies?.refresh_token;

    await this.authService.logout(user.id, refreshToken);

    // Clear refresh token cookie
    res.clearCookie('refresh_token');

    return {
      success: true,
      statusCode: 200,
      message: 'Logout successful',
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Request() req: ExpressRequest) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const result = await this.authService.refreshToken(refreshToken);

    return {
      success: true,
      statusCode: 200,
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA setup successful' })
  async setup2FA(@Request() req: ExpressRequest) {
    const user = req.user as any;
    
    const secret = this.twoFactorService.generateSecret(user.email);
    const qrCode = this.twoFactorService.generateQRCode(secret, user.email);
    const backupCodes = this.twoFactorService.generateBackupCodes();

    return {
      success: true,
      statusCode: 200,
      message: '2FA setup initiated',
      data: {
        secret,
        qrCode,
        backupCodes,
      },
    };
  }

  @Post('2fa/enable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  async enable2FA(
    @Body() body: { secret: string; code: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    
    await this.authService.enable2FA(user.id, body.secret, body.code);

    return {
      success: true,
      statusCode: 200,
      message: 'Two-factor authentication enabled successfully',
    };
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  async disable2FA(
    @Body() body: { code: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    
    await this.authService.disable2FA(user.id, body.code);

    return {
      success: true,
      statusCode: 200,
      message: 'Two-factor authentication disabled successfully',
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async forgotPassword(@Body() body: { email: string }) {
    await this.authService.forgotPassword(body.email);

    return {
      success: true,
      statusCode: 200,
      message: 'If an account exists with this email, a password reset link has been sent',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    await this.authService.resetPassword(body.token, body.newPassword);

    return {
      success: true,
      statusCode: 200,
      message: 'Password reset successfully',
    };
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);

    return {
      success: true,
      statusCode: 200,
      message: 'Password changed successfully',
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@Request() req: ExpressRequest) {
    const user = req.user as any;

    return {
      success: true,
      statusCode: 200,
      message: 'Profile retrieved successfully',
      data: user,
    };
  }
}
