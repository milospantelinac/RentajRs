import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyTwoFactorDto } from './dto/login.dto';
import { RefreshTokenDto, VerifyEmailDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/password.dto';
import { ConfirmTwoFactorSetupDto, DisableTwoFactorDto, GenerateTwoFactorDto } from './dto/two-factor.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { GoogleProfile } from './strategies/google.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip ?? '',
      device: req.headers['user-agent']?.toString().slice(0, 255) ?? 'unknown',
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string, @Req() req: Request) {
    return this.authService.register(dto, this.meta(req));
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  resendVerification(@CurrentUser('id') userId: string) {
    return this.authService.resendVerificationEmail(userId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/2fa')
  verifyTwoFactorLogin(@Body() dto: VerifyTwoFactorDto, @Req() req: Request) {
    return this.authService.verifyTwoFactorLogin(dto, this.meta(req));
  }

  @Public()
  @Post('login/2fa/setup-generate')
  generateTwoFactorSetupAtLogin(@Body('tempToken') tempToken: string) {
    return this.authService.generateTwoFactorSecretWithTempToken(tempToken);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/2fa/setup-confirm')
  confirmTwoFactorSetupAtLogin(
    @Body() dto: ConfirmTwoFactorSetupDto & { tempToken: string },
    @Req() req: Request,
  ) {
    return this.authService.confirmTwoFactorSetupWithTempToken(
      dto.tempToken,
      dto.code,
      this.meta(req),
    );
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto, dto.currentRefreshToken);
  }

  @Post('2fa/generate')
  generateTwoFactor(@CurrentUser('id') userId: string, @Body() dto: GenerateTwoFactorDto) {
    return this.authService.generateTwoFactorSecret(userId, dto.password);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/confirm')
  confirmTwoFactor(@CurrentUser('id') userId: string, @Body() dto: ConfirmTwoFactorSetupDto) {
    return this.authService.confirmTwoFactorSetup(userId, dto.code);
  }

  @Post('2fa/disable')
  disableTwoFactor(@CurrentUser('id') userId: string, @Body() dto: DisableTwoFactorDto) {
    return this.authService.disableTwoFactor(userId, dto.password);
  }

  // -- Google OAuth ---------------------------------------------------------

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Guard redirects to Google; handler body never runs.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfile;
    const result = await this.authService.loginWithGoogle(profile, this.meta(req));
    // R19 fix: the real tokens never go in the URL — only a one-time code
    // that's exchanged for them via POST /auth/google/exchange below.
    const code = await this.authService.createGoogleExchangeCode(result.accessToken, result.refreshToken);
    const frontendUrl = this.config.get<string>('frontendUrl');
    res.redirect(`${frontendUrl}/auth/google/callback?code=${code}`);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/exchange')
  exchangeGoogleCode(@Body('code') code: string) {
    return this.authService.exchangeGoogleCode(code);
  }
}
