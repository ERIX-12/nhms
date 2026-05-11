import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { TwoFactorService } from './services/two-factor.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';

import { UserModule } from '../user/user.module';
import { MailModule } from '../../shared/mail/mail.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../../shared/audit/audit.module';

@Module({
  imports: [
    UserModule,
    MailModule,
    NotificationModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'auth-queue',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    TwoFactorService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    AuthGuard,
    RolesGuard,
    Public,
    Roles,
  ],
  exports: [AuthService, TokenService, TwoFactorService, AuthGuard, RolesGuard],
})
export class AuthModule {}
