import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyTwoFactorDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/password.dto';
import { GoogleProfile } from './strategies/google.strategy';

export interface RequestMeta {
  ip: string;
  device: string;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL = '1d';
const TWO_FACTOR_PENDING_TTL = '5m';
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
const GOOGLE_EXCHANGE_TTL_SECONDS = 30;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private i18n: I18nService,
    private events: EventEmitter2,
    private cache: CacheService,
    private users: UsersService,
  ) {}

  // -- Registration ----------------------------------------------------

  async register(dto: RegisterDto, meta: RequestMeta) {
    if (dto.website) {
      // Honeypot tripped (R177) — pretend success, do nothing.
      return { message: this.i18n.t('auth.REGISTRATION_RECEIVED') };
    }

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(this.i18n.t('errors.EMAIL_ALREADY_REGISTERED'));
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { firstName: dto.firstName, lastName: dto.lastName, email, passwordHash },
    });

    await this.prisma.consent.createMany({
      data: [
        { userId: user.id, document: 'TERMS', version: dto.termsVersion, ipAddress: meta.ip },
        { userId: user.id, document: 'PRIVACY', version: dto.termsVersion, ipAddress: meta.ip },
      ],
    });

    const token = this.signPurposeToken(user.id, 'verify-email', EMAIL_VERIFICATION_TTL);
    this.events.emit('auth.registered', { userId: user.id, verificationToken: token });

    return { message: this.i18n.t('auth.REGISTRATION_RECEIVED') };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerified) return { message: this.i18n.t('auth.ALREADY_VERIFIED') };
    const token = this.signPurposeToken(user.id, 'verify-email', EMAIL_VERIFICATION_TTL);
    this.events.emit('auth.verification_resent', { userId: user.id, verificationToken: token });
    return { message: this.i18n.t('auth.VERIFICATION_SENT') };
  }

  async verifyEmail(token: string) {
    const payload = this.verifyPurposeToken(token, 'verify-email');
    await this.prisma.user.update({ where: { id: payload.sub }, data: { emailVerified: true } });
    return { message: this.i18n.t('auth.EMAIL_VERIFIED') };
  }

  // -- Login -------------------------------------------------------------

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.validateCredentials(dto.email, dto.password);

    const isAdmin = await this.users.isAdmin(user.id);
    if (isAdmin && !user.twoFactorEnabled) {
      // R127: 2FA is mandatory for admins. Instead of allowing an unprotected
      // login, we hand back a setup-required signal with the same pending
      // token shape used for normal 2FA verification.
      const tempToken = this.signPurposeToken(user.id, '2fa-setup-required', TWO_FACTOR_PENDING_TTL);
      return { twoFactorSetupRequired: true, tempToken };
    }

    if (user.twoFactorEnabled) {
      const tempToken = this.signPurposeToken(user.id, '2fa-pending', TWO_FACTOR_PENDING_TTL);
      return { twoFactorRequired: true, tempToken };
    }

    return this.issueSession(user.id, dto.rememberMe ?? false, meta);
  }

  async verifyTwoFactorLogin(dto: VerifyTwoFactorDto, meta: RequestMeta) {
    const payload = this.verifyPurposeToken(dto.tempToken, '2fa-pending');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    const totpValid =
      !!user.twoFactorSecret &&
      speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: dto.code, window: 1 });
    if (!totpValid && !(await this.consumeBackupCode(user.id, user.twoFactorBackupCodes, dto.code))) {
      throw new UnauthorizedException(this.i18n.t('errors.TWO_FACTOR_INVALID'));
    }
    return this.issueSession(user.id, false, meta);
  }

  private async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
    }
    if (user.blocked) {
      throw new ForbiddenException(
        this.i18n.t('errors.ACCOUNT_BLOCKED', { args: { reason: user.blockedReason ?? '' } }),
      );
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(this.i18n.t('errors.ACCOUNT_LOCKED', { args: { minutes } }));
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockedUntil },
      });
      throw new UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
    }

    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    return user;
  }

  // -- Google OAuth --------------------------------------------------------

  async loginWithGoogle(profile: GoogleProfile, meta: RequestMeta) {
    if (!profile.email) {
      throw new BadRequestException('Google account has no email address');
    }
    const email = profile.email.toLowerCase();

    let login = await this.prisma.userLogin.findUnique({
      where: { provider_externalId: { provider: 'GOOGLE', externalId: profile.googleId } },
    });

    let userId: string;
    if (login) {
      userId = login.userId;
    } else {
      // R125: same email never creates a second account — link instead.
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const created = await this.prisma.user.create({
          data: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email,
            emailVerified: true,
            avatarUrl: profile.avatarUrl,
          },
        });
        userId = created.id;
      }
      await this.prisma.userLogin.create({
        data: { userId, provider: 'GOOGLE', externalId: profile.googleId },
      });
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.blocked) {
      throw new ForbiddenException(
        this.i18n.t('errors.ACCOUNT_BLOCKED', { args: { reason: user.blockedReason ?? '' } }),
      );
    }
    return this.issueSession(user.id, true, meta);
  }

  /**
   * R19 fix: the OAuth callback used to hand real access/refresh tokens back
   * to the browser as URL query params, where they'd sit in history and any
   * referrer header. Instead it mints a random one-time code, stashes the
   * already-issued session tokens behind it for 30s, and the frontend
   * exchanges that code for the real tokens via a follow-up POST
   * (exchangeGoogleCode below) — the tokens themselves never touch a URL.
   */
  async createGoogleExchangeCode(accessToken: string, refreshToken: string): Promise<string> {
    const code = crypto.randomBytes(24).toString('hex');
    await this.cache.set(this.googleExchangeCacheKey(code), { accessToken, refreshToken }, GOOGLE_EXCHANGE_TTL_SECONDS);
    return code;
  }

  async exchangeGoogleCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const key = this.googleExchangeCacheKey(code);
    const payload = await this.cache.get<{ accessToken: string; refreshToken: string }>(key);
    if (!payload) throw new UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
    await this.cache.del(key); // one-time use
    return payload;
  }

  private googleExchangeCacheKey(code: string): string {
    return `auth:google-exchange:${code}`;
  }

  // -- Tokens / sessions -----------------------------------------------

  private async issueSession(userId: string, rememberMe: boolean, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const seenDeviceBefore = await this.prisma.session.findFirst({
      where: { userId, device: meta.device },
    });
    if (!seenDeviceBefore) {
      this.events.emit('auth.new_device_login', { userId, device: meta.device, ip: meta.ip });
    }

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const days = rememberMe ? this.config.get<number>('jwt.rememberMeDays')! : 1;

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        device: meta.device,
        ipAddress: meta.ip,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!session) throw new UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.blocked) throw new UnauthorizedException();

    const newRefreshToken = crypto.randomBytes(48).toString('hex');
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(newRefreshToken),
          device: session.device,
          ipAddress: session.ipAddress,
          expiresAt: session.expiresAt,
        },
      }),
    ]);

    return { accessToken: this.signAccessToken(user.id, user.email), refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: this.i18n.t('auth.LOGGED_OUT') };
  }

  async logoutAllSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // -- Password ----------------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    // Always return the same response — do not reveal whether the email exists.
    if (user && user.passwordHash) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      this.events.emit('auth.password_reset_requested', { userId: user.id, resetToken: rawToken });
    }
    return { message: this.i18n.t('auth.PASSWORD_RESET_EMAIL_SENT') };
  }

  /**
   * RNT-014 — the only self-service way back in for an admin locked out of
   * 2FA (lost/reinstalled authenticator, no backup code saved). Proving
   * ownership of the account email is the same trust boundary the reset
   * token itself already relies on, so clearing 2FA here doesn't weaken
   * anything — it's already what "I own this account" means at this point.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const reset = await this.prisma.passwordReset.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!reset) throw new UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: reset.userId } });
    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: user.twoFactorEnabled
          ? { passwordHash, twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] }
          : { passwordHash },
      }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ]);
    await this.logoutAllSessions(reset.userId);
    this.events.emit('auth.password_changed', { userId: reset.userId });
    if (user.twoFactorEnabled) {
      this.events.emit('auth.two_factor_reset_by_password_reset', { userId: reset.userId });
    }
    return { message: this.i18n.t('auth.PASSWORD_RESET_SUCCESS') };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, currentSessionRefreshToken?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // "Changing password revokes every other session" — keep the current one alive.
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionRefreshToken
          ? { tokenHash: { not: this.hashToken(currentSessionRefreshToken) } }
          : {}),
      },
      data: { revokedAt: new Date() },
    });
    this.events.emit('auth.password_changed', { userId });
    return { message: this.i18n.t('auth.PASSWORD_CHANGED') };
  }

  // -- Two-factor authentication ------------------------------------------

  /**
   * R17 fix: regenerating a secret silently turns off 2FA protection until
   * setup is re-confirmed, so — like disableTwoFactor() — it must re-check
   * the password rather than trusting a bare access token. The bootstrap
   * path (generateTwoFactorSecretWithTempToken) skips this on purpose: the
   * tempToken itself is only issued right after a correct-password login.
   */
  async generateTwoFactorSecret(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
    }
    return this.createTwoFactorSecret(user.id, user.email);
  }

  private async createTwoFactorSecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({
      name: `${this.config.get('twoFactor.appName')} (${email})`,
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32, twoFactorEnabled: false },
    });
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!, { width: 240, margin: 1 });
    return { secret: secret.base32, otpauthUrl: secret.otpauth_url, qrCodeDataUrl };
  }

  async confirmTwoFactorSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.assertTotpValid(user.twoFactorSecret, code);
    const { plaintext, hashes } = await this.generateBackupCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashes },
    });
    return { message: this.i18n.t('auth.TWO_FACTOR_ENABLED'), backupCodes: plaintext };
  }

  /**
   * The bootstrap step confirmTwoFactorSetupWithTempToken() below assumes a
   * secret already exists — but an admin who has never set up 2FA has no
   * access token yet to call the normal generateTwoFactorSecret(), only the
   * limited-purpose tempToken from login(). This is that missing first step,
   * gated the same way (payload.purpose check) instead of requiring a full session.
   */
  async generateTwoFactorSecretWithTempToken(tempToken: string) {
    const payload = this.verifyPurposeToken(tempToken, '2fa-setup-required');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.createTwoFactorSecret(user.id, user.email);
  }

  /** Used right after login when an admin has no 2FA configured yet (see login()). */
  async confirmTwoFactorSetupWithTempToken(tempToken: string, code: string, meta: RequestMeta) {
    const payload = this.verifyPurposeToken(tempToken, '2fa-setup-required');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    this.assertTotpValid(user.twoFactorSecret, code);
    const { plaintext, hashes } = await this.generateBackupCodes();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashes },
    });
    const session = await this.issueSession(user.id, false, meta);
    return { ...session, backupCodes: plaintext };
  }

  async disableTwoFactor(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });
    return { message: this.i18n.t('auth.TWO_FACTOR_DISABLED') };
  }

  /**
   * RNT-014 — an admin whose only authenticator device is unavailable had no
   * way back in. 8 single-use codes, generated once 2FA is actually enabled
   * (never for an abandoned setup), shown to the user exactly once and
   * stored as argon2 hashes like a password — never in plaintext.
   */
  private async generateBackupCodes(): Promise<{ plaintext: string[]; hashes: string[] }> {
    const plaintext = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
    const hashes = await Promise.all(plaintext.map((code) => argon2.hash(code)));
    return { plaintext, hashes };
  }

  private async consumeBackupCode(userId: string, hashes: string[], code: string): Promise<boolean> {
    const normalized = code.trim().toUpperCase();
    for (const hash of hashes) {
      if (await argon2.verify(hash, normalized)) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { twoFactorBackupCodes: hashes.filter((h) => h !== hash) },
        });
        return true;
      }
    }
    return false;
  }

  private assertTotpValid(secret: string | null, code: string) {
    if (!secret) throw new UnauthorizedException(this.i18n.t('errors.TWO_FACTOR_REQUIRED'));
    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!valid) throw new UnauthorizedException(this.i18n.t('errors.TWO_FACTOR_INVALID'));
  }

  // -- Helpers -------------------------------------------------------------

  private signAccessToken(userId: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, email },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      },
    );
  }

  private signPurposeToken(userId: string, purpose: string, expiresIn: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose },
      { secret: this.config.get<string>('jwt.accessSecret'), expiresIn },
    );
  }

  private verifyPurposeToken(token: string, expectedPurpose: string): { sub: string } {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
    }
    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
    }
    return payload;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    language: string;
    emailVerified: boolean;
  }) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      language: user.language,
      emailVerified: user.emailVerified,
    };
  }
}
