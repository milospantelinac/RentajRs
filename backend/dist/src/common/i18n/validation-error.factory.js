"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenValidationErrors = flattenValidationErrors;
exports.i18nValidationExceptionFactory = i18nValidationExceptionFactory;
const common_1 = require("@nestjs/common");
const nestjs_i18n_1 = require("nestjs-i18n");
const CONSTRAINT_KEY_MAP = {
    isNotEmpty: 'validation.REQUIRED',
    isString: 'validation.STRING',
    isEmail: 'validation.EMAIL',
    minLength: 'validation.MIN_LENGTH',
    maxLength: 'validation.MAX_LENGTH',
    min: 'validation.MIN',
    max: 'validation.MAX',
    isNumber: 'validation.NUMBER',
    isInt: 'validation.NUMBER',
    isBoolean: 'validation.BOOLEAN',
    isEnum: 'validation.ENUM',
    isUuid: 'validation.UUID',
    isDate: 'validation.DATE',
    isArray: 'validation.ARRAY',
    notCommonPassword: 'validation.PASSWORD_WEAK',
    matches: 'validation.PHONE_INVALID',
};
function flattenValidationErrors(errors, i18n, parentPath = '') {
    const out = [];
    for (const err of errors) {
        const field = parentPath ? `${parentPath}.${err.property}` : err.property;
        if (err.constraints) {
            for (const [constraintKey, fallback] of Object.entries(err.constraints)) {
                const i18nKey = CONSTRAINT_KEY_MAP[constraintKey];
                const message = i18nKey ? String(i18n?.t(i18nKey, { args: { property: field } }) ?? fallback) : fallback;
                out.push({ field, message });
            }
        }
        if (err.children?.length) {
            out.push(...flattenValidationErrors(err.children, i18n, field));
        }
    }
    return out;
}
function i18nValidationExceptionFactory(errors) {
    const i18n = nestjs_i18n_1.I18nContext.current();
    const messages = flattenValidationErrors(errors, i18n);
    return new common_1.BadRequestException({
        error: 'ValidationError',
        message: messages.map((m) => m.message),
        fields: messages,
    });
}
//# sourceMappingURL=validation-error.factory.js.map