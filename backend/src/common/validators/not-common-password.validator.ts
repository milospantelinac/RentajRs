import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * §13.2: "minimum 8 characters, checked against the list of most common
 * passwords". This is a representative top-100 list (rockyou-style), not an
 * exhaustive breach-database check — swapping in a HaveIBeenPwned-style API
 * call is a drop-in replacement for isCommonPassword() below if needed later.
 */
const COMMON_PASSWORDS = new Set(
  [
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
  ].map((p) => p.toLowerCase()),
);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

export function NotCommonPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'notCommonPassword',
      target: object.constructor,
      propertyName,
      // The real, localized message is resolved from the constraint name
      // ("notCommonPassword") by buildValidationErrors() in
      // common/i18n/validation-error.factory.ts — this is only the raw
      // class-validator fallback, never shown to a user directly.
      options: validationOptions ?? { message: 'Password is too weak' },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && value.length >= 8 && !isCommonPassword(value);
        },
      },
    });
  };
}
