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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const sharp_1 = __importDefault(require("sharp"));
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let UploadsService = class UploadsService {
    constructor(config) {
        this.config = config;
    }
    async saveImage(file, folder, options = { maxWidth: 1600 }) {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Only JPEG, PNG or WEBP images are allowed');
        }
        const maxSizeMb = options.maxSizeMb ?? this.config.get('uploads.maxPhotoSizeMb');
        const maxSizeBytes = maxSizeMb * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            throw new common_1.BadRequestException('File is too large');
        }
        let processed;
        try {
            processed = await (0, sharp_1.default)(file.buffer)
                .rotate()
                .resize({ width: options.maxWidth, height: options.maxHeight, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 82 })
                .toBuffer();
        }
        catch {
            throw new common_1.BadRequestException('The uploaded file is not a valid image');
        }
        const dir = path.join(process.cwd(), this.config.get('uploads.dir'), folder);
        await fs.mkdir(dir, { recursive: true });
        const filename = `${(0, crypto_1.randomUUID)()}.webp`;
        await fs.writeFile(path.join(dir, filename), processed);
        const relativePath = `${folder}/${filename}`;
        return { url: `${this.config.get('uploads.baseUrl')}/${relativePath}`, relativePath };
    }
    async deleteFile(relativePath) {
        const full = path.join(process.cwd(), this.config.get('uploads.dir'), relativePath);
        await fs.unlink(full).catch(() => undefined);
    }
    async saveRawFile(file, folder, allowedMimeTypes, maxSizeMb = 5) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException('File type not allowed');
        }
        if (file.size > maxSizeMb * 1024 * 1024) {
            throw new common_1.BadRequestException('File is too large');
        }
        const dir = path.join(process.cwd(), this.config.get('uploads.dir'), folder);
        await fs.mkdir(dir, { recursive: true });
        const ext = path.extname(file.originalname).toLowerCase() || '';
        const filename = `${(0, crypto_1.randomUUID)()}${ext}`;
        await fs.writeFile(path.join(dir, filename), file.buffer);
        const relativePath = `${folder}/${filename}`;
        return { url: `${this.config.get('uploads.baseUrl')}/${relativePath}`, relativePath };
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map