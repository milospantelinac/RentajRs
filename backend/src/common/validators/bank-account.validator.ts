import { registerDecorator, ValidationOptions } from 'class-validator';
import { normalizeBankAccount } from '../utils/ips-qr';

/**
 * T142: a Serbian account written as 000-0000000000000-00 whose control
 * digits check out (mod 97). Banks refuse any other number, and so does the
 * NBS IPS QR code a guest pays the owner with, so it is stopped here, where
 * the owner can still fix it.
 */
export function IsBankAccount(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBankAccount',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && /^\d{3}-\d{1,13}-\d{2}$/.test(value) && normalizeBankAccount(value) !== null;
        },
      },
    });
  };
}
