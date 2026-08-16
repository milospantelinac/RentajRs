import { Transform } from 'class-transformer';

/**
 * An empty string means "not provided" for an optional field left blank in a
 * form — without this, @IsOptional() only short-circuits on null/undefined,
 * so a blank input still hits whatever @Matches()/pattern validator follows
 * and 400s the whole request (see RNT-013: saving a profile with an empty
 * bank account field failed outright, with no usable error message).
 */
export const undefinedIfBlank = Transform(({ value }) => (value === '' ? undefined : value));
