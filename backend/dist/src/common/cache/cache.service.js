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
let CacheService = CacheService_1 = class CacheService {
    constructor(config) {
        this.logger = new common_1.Logger(CacheService_1.name);
        this.client = new ioredis_1.default({
            host: config.get('redis.host'),
            port: config.get('redis.port'),
            lazyConnect: false,
            maxRetriesPerRequest: 2,
        });
        this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
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
            await this.client.del(keys);
    }
    async delByPrefix(prefix) {
        const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
        const toDelete = [];
        for await (const keys of stream) {
            toDelete.push(...keys);
        }
        if (toDelete.length)
            await this.client.del(toDelete);
    }
    async getOrSet(key, ttlSeconds, compute) {
        const cached = await this.get(key);
        if (cached !== null)
            return cached;
        const value = await compute();
        await this.set(key, value, ttlSeconds);
        return value;
    }
    async onModuleDestroy() {
        await this.client.quit();
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CacheService);
//# sourceMappingURL=cache.service.js.map