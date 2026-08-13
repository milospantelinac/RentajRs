"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCommonPassword = isCommonPassword;
exports.NotCommonPassword = NotCommonPassword;
const class_validator_1 = require("class-validator");
const COMMON_PASSWORDS = new Set([
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'password123',
    'qwerty123',
    'qwertyuiop',
    '11111111',
    '00000000',
    'iloveyou',
    'admin123',
    'welcome1',
    'letmein1',
    'monkey123',
    'football1',
    'baseball1',
    'dragon123',
    'master123',
    'sunshine1',
    'princess1',
    'trustno1',
    'abc123456',
    '123123123',
    'zaq12wsx',
    'passw0rd',
    'starwars1',
    'whatever1',
    'shadow123',
    'superman1',
    '87654321',
    'qazwsxedc',
    'lozinka1',
    'lozinka123',
    '12345678a',
].map((p) => p.toLowerCase()));
function isCommonPassword(password) {
    return COMMON_PASSWORDS.has(password.toLowerCase());
}
function NotCommonPassword(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'notCommonPassword',
            target: object.constructor,
            propertyName,
            options: validationOptions ?? { message: 'Password is too weak' },
            validator: {
                validate(value) {
                    return typeof value === 'string' && value.length >= 8 && !isCommonPassword(value);
                },
            },
        });
    };
}
//# sourceMappingURL=not-common-password.validator.js.map