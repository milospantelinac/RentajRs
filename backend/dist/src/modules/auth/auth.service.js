"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const argon2 = __importStar(require("argon2"));
const crypto = __importStar(require("crypto"));
const speakeasy = __importStar(require("speakeasy"));
const QRCode = __importStar(require("qrcode"));
const prisma_service_1 = require("../../prisma/prisma.service");
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL = '1d';
const TWO_FACTOR_PENDING_TTL = '5m';
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
let AuthService = class AuthService {
    constructor(prisma, jwtService, config, i18n, events) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.config = config;
        this.i18n = i18n;
        this.events = events;
    }
    async register(dto, meta) {
        if (dto.website) {
            return { message: this.i18n.t('auth.REGISTRATION_RECEIVED') };
        }
        const email = dto.email.toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new common_1.ConflictException(this.i18n.t('errors.EMAIL_ALREADY_REGISTERED'));
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
    async resendVerificationEmail(userId) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.emailVerified)
            return { message: this.i18n.t('auth.ALREADY_VERIFIED') };
        const token = this.signPurposeToken(user.id, 'verify-email', EMAIL_VERIFICATION_TTL);
        this.events.emit('auth.verification_resent', { userId: user.id, verificationToken: token });
        return { message: this.i18n.t('auth.VERIFICATION_SENT') };
    }
    async verifyEmail(token) {
        const payload = this.verifyPurposeToken(token, 'verify-email');
        await this.prisma.user.update({ where: { id: payload.sub }, data: { emailVerified: true } });
        return { message: this.i18n.t('auth.EMAIL_VERIFIED') };
    }
    async login(dto, meta) {
        const user = await this.validateCredentials(dto.email, dto.password);
        const isAdmin = await this.isAdmin(user.id);
        if (isAdmin && !user.twoFactorEnabled) {
            const tempToken = this.signPurposeToken(user.id, '2fa-setup-required', TWO_FACTOR_PENDING_TTL);
            return { twoFactorSetupRequired: true, tempToken };
        }
        if (user.twoFactorEnabled) {
            const tempToken = this.signPurposeToken(user.id, '2fa-pending', TWO_FACTOR_PENDING_TTL);
            return { twoFactorRequired: true, tempToken };
        }
        return this.issueSession(user.id, dto.rememberMe ?? false, meta);
    }
    async verifyTwoFactorLogin(dto, meta) {
        const payload = this.verifyPurposeToken(dto.tempToken, '2fa-pending');
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
        this.assertTotpValid(user.twoFactorSecret, dto.code);
        return this.issueSession(user.id, false, meta);
    }
    async validateCredentials(email, password) {
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
        }
        if (user.blocked) {
            throw new common_1.ForbiddenException(this.i18n.t('errors.ACCOUNT_BLOCKED', { args: { reason: user.blockedReason ?? '' } }));
        }
        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
            const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            throw new common_1.UnauthorizedException(this.i18n.t('errors.ACCOUNT_LOCKED', { args: { minutes } }));
        }
        const valid = await argon2.verify(user.passwordHash, password);
        if (!valid) {
            const attempts = user.failedLoginAttempts + 1;
            const lockedUntil = attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null;
            await this.prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: attempts, lockedUntil },
            });
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
        }
        if (user.failedLoginAttempts > 0) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            });
        }
        return user;
    }
    async isAdmin(userId) {
        const count = await this.prisma.userPermission.count({ where: { userId } });
        return count > 0;
    }
    async loginWithGoogle(profile, meta) {
        if (!profile.email) {
            throw new common_1.BadRequestException('Google account has no email address');
        }
        const email = profile.email.toLowerCase();
        let login = await this.prisma.userLogin.findUnique({
            where: { provider_externalId: { provider: 'GOOGLE', externalId: profile.googleId } },
        });
        let userId;
        if (login) {
            userId = login.userId;
        }
        else {
            const existingUser = await this.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                userId = existingUser.id;
            }
            else {
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
            throw new common_1.ForbiddenException(this.i18n.t('errors.ACCOUNT_BLOCKED', { args: { reason: user.blockedReason ?? '' } }));
        }
        return this.issueSession(user.id, true, meta);
    }
    async issueSession(userId, rememberMe, meta) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const seenDeviceBefore = await this.prisma.session.findFirst({
            where: { userId, device: meta.device },
        });
        if (!seenDeviceBefore) {
            this.events.emit('auth.new_device_login', { userId, device: meta.device, ip: meta.ip });
        }
        const accessToken = this.signAccessToken(user.id, user.email);
        const refreshToken = crypto.randomBytes(48).toString('hex');
        const days = rememberMe ? this.config.get('jwt.rememberMeDays') : 1;
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
    async refresh(refreshToken) {
        const tokenHash = this.hashToken(refreshToken);
        const session = await this.prisma.session.findFirst({
            where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        });
        if (!session)
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
        const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
        if (!user || user.blocked)
            throw new common_1.UnauthorizedException();
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
    async logout(refreshToken) {
        await this.prisma.session.updateMany({
            where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return { message: this.i18n.t('auth.LOGGED_OUT') };
    }
    async logoutAllSessions(userId) {
        await this.prisma.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async forgotPassword(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
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
    async resetPassword(dto) {
        const tokenHash = this.hashToken(dto.token);
        const reset = await this.prisma.passwordReset.findFirst({
            where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        });
        if (!reset)
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
        const passwordHash = await argon2.hash(dto.password);
        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
            this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
        ]);
        await this.logoutAllSessions(reset.userId);
        this.events.emit('auth.password_changed', { userId: reset.userId });
        return { message: this.i18n.t('auth.PASSWORD_RESET_SUCCESS') };
    }
    async changePassword(userId, dto, currentSessionRefreshToken) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!user.passwordHash || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
        }
        const passwordHash = await argon2.hash(dto.newPassword);
        await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
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
    async generateTwoFactorSecret(userId) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const secret = speakeasy.generateSecret({
            name: `${this.config.get('twoFactor.appName')} (${user.email})`,
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { twoFactorSecret: secret.base32, twoFactorEnabled: false },
        });
        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, { width: 240, margin: 1 });
        return { secret: secret.base32, otpauthUrl: secret.otpauth_url, qrCodeDataUrl };
    }
    async confirmTwoFactorSetup(userId, code) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        this.assertTotpValid(user.twoFactorSecret, code);
        await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
        return { message: this.i18n.t('auth.TWO_FACTOR_ENABLED') };
    }
    async generateTwoFactorSecretWithTempToken(tempToken) {
        const payload = this.verifyPurposeToken(tempToken, '2fa-setup-required');
        return this.generateTwoFactorSecret(payload.sub);
    }
    async confirmTwoFactorSetupWithTempToken(tempToken, code, meta) {
        const payload = this.verifyPurposeToken(tempToken, '2fa-setup-required');
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
        this.assertTotpValid(user.twoFactorSecret, code);
        await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
        return this.issueSession(user.id, false, meta);
    }
    async disableTwoFactor(userId, password) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!user.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_CREDENTIALS'));
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { twoFactorEnabled: false, twoFactorSecret: null },
        });
        return { message: this.i18n.t('auth.TWO_FACTOR_DISABLED') };
    }
    assertTotpValid(secret, code) {
        if (!secret)
            throw new common_1.UnauthorizedException(this.i18n.t('errors.TWO_FACTOR_REQUIRED'));
        const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
        if (!valid)
            throw new common_1.UnauthorizedException(this.i18n.t('errors.TWO_FACTOR_INVALID'));
    }
    signAccessToken(userId, email) {
        return this.jwtService.sign({ sub: userId, email }, {
            secret: this.config.get('jwt.accessSecret'),
            expiresIn: this.config.get('jwt.accessExpiresIn'),
        });
    }
    signPurposeToken(userId, purpose, expiresIn) {
        return this.jwtService.sign({ sub: userId, purpose }, { secret: this.config.get('jwt.accessSecret'), expiresIn });
    }
    verifyPurposeToken(token, expectedPurpose) {
        let payload;
        try {
            payload = this.jwtService.verify(token, {
                secret: this.config.get('jwt.accessSecret'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
        }
        if (payload.purpose !== expectedPurpose) {
            throw new common_1.UnauthorizedException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
        }
        return payload;
    }
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    toPublicUser(user) {
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], AuthService);
//# sourceMappingURL=auth.service.js.map