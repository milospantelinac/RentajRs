import { BadRequestException, ValidationError } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';

/**
 * Maps class-validator's constraint names (the keys it puts on
 * ValidationError.constraints) to keys in i18n/{lang}/validation.json.
 *
 * Why this exists instead of nestjs-i18n's own i18nValidationMessage()
 * helper: that helper resolves the translation *inside* each decorator at
 * validation time via I18nContext.current(), which depends on CLS-scoped
 * request context being attached before class-validator runs — fragile
 * across Nest versions/adapters. Resolving by constraint name here, once,
 * after validation has already produced its (language-agnostic) constraint
 * keys, is simpler and independently testable.
 */
const CONSTRAINT_KEY_MAP: Record<string, string> = {
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
  // No generic entry for 'matches' — it's class-validator's constraint name
  // for every @Matches() in the app (phone, bank account, time-of-day, ...),
  // so a single shared translation is always wrong for most of them. Each
  // @Matches() must supply its own `message` i18n key instead (see below).
};

/** A decorator's own `message: 'validation.SOMETHING'` looks like this — dotted, no spaces. */
const I18N_KEY_PATTERN = /^[a-zA-Z]+(\.[A-Za-z0-9_]+)+$/;

export interface FlatValidationMessage {
  field: string;
  message: string;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  i18n: I18nContext | undefined,
  parentPath = '',
): FlatValidationMessage[] {
  const out: FlatValidationMessage[] = [];

  for (const err of errors) {
    const field = parentPath ? `${parentPath}.${err.property}` : err.property;

    if (err.constraints) {
      for (const [constraintKey, fallback] of Object.entries(err.constraints)) {
        // A decorator's own `message: 'validation.X'` (e.g. @Matches(re, {
        // message: 'validation.BANK_ACCOUNT_INVALID' })) lands in `fallback`
        // verbatim — prefer it over the generic per-constraint-type map,
        // which can't tell one @Matches() field from another.
        const i18nKey = I18N_KEY_PATTERN.test(fallback) ? fallback : CONSTRAINT_KEY_MAP[constraintKey];
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

export function i18nValidationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const i18n = I18nContext.current();
  const messages = flattenValidationErrors(errors, i18n);
  return new BadRequestException({
    error: 'ValidationError',
    message: messages.map((m) => m.message),
    fields: messages,
  });
}
