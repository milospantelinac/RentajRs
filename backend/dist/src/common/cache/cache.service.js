"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const derived_keys_1 = require("./derived-keys");
const COMMAND_TIMEOUT_MS = 500;
const BYPASS_AFTER_FAILURE_MS = 5000;
let CacheService = CacheService_1 = class CacheService {
    constructor(config) {
        this.logger = new common_1.Logger(CacheService_1.name);
        this.unavailable = false;
        this.bypassUntil = 0;
        this.client = new ioredis_1.default({
            host: config.get('redis.host'),
            port: config.get('redis.port'),
            lazyConnect: false,
            maxRetriesPerRequest: 2,
            enableOfflineQueue: false,
            commandTimeout: COMMAND_TIMEOUT_MS,
        });
        this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
        this.client.on('ready', () => this.backInUse());
    }
    async get(key) {
        const raw = await this.client.get(key);
        return raw ? JSON.parse(raw) : null;
    }
    async set(key, value, ttlSeconds) {
        await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
    async del(...keys) {
        if (keys.length)
            await this.optional(() => this.client.del(keys));
    }
    async delByPrefix(prefix) {
        await this.optional(() => (0, derived_keys_1.deleteByPrefix)(this.client, prefix));
    }
    async getOrSet(key, ttlSeconds, compute) {
        if (this.bypassing())
            return compute();
        const cached = await this.optional(() => this.client.get(key));
        if (cached)
            return JSON.parse(cached);
        const value = await compute();
        const serialized = JSON.stringify(value);
        if (!this.bypassing())
            await this.optional(() => this.client.set(key, serialized, 'EX', ttlSeconds));
        return value;
    }
    async onModuleDestroy() {
        await this.client.quit().catch(() => this.client.disconnect());
    }
    backInUse() {
        if (this.unavailable)
            this.logger.log('Redis answers again, cache back in use');
        this.unavailable = false;
        this.bypassUntil = 0;
        void this.dropDerivedData();
    }
    async dropDerivedData() {
        for (const prefix of derived_keys_1.DERIVED_KEY_PREFIXES)
            await this.delByPrefix(prefix);
    }
    bypassing() {
        return Date.now() < this.bypassUntil;
    }
    async optional(command) {
        try {
            const result = await command();
            if (this.unavailable)
                this.backInUse();
            return result;
        }
        catch (err) {
            this.bypassUntil = Date.now() + BYPASS_AFTER_FAILURE_MS;
            if (!this.unavailable) {
                this.unavailable = true;
                this.logger.warn(`Redis unavailable, reading from the database: ${err.message}`);
            }
            return undefined;
        }
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CacheService);
//# sourceMappingURL=cache.service.js.map