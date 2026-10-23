import { grantBillingCycle, periodEnd } from './free-listing-period';

describe('periodEnd (Administracija > Oglasi)', () => {
  it('ends a number of months later, at the end of that Belgrade day', () => {
    // 22. 10. 2026 + 1 month: all of 22. 11. (winter time, UTC+1).
    expect(periodEnd(new Date('2026-10-22T12:00:00Z'), 1, 'MONTHS')).toEqual(new Date('2026-11-22T22:59:59.999Z'));
    // A year on: 22. 10. 2027 is still summer time (UTC+2).
    expect(periodEnd(new Date('2026-10-22T12:00:00Z'), 12, 'MONTHS')).toEqual(new Date('2027-10-22T21:59:59.999Z'));
    expect(periodEnd(new Date('2026-06-15T10:00:00Z'), 1, 'MONTHS')).toEqual(new Date('2026-07-15T21:59:59.999Z'));
  });

  it('keeps to the last day of a shorter month', () => {
    expect(periodEnd(new Date('2027-01-31T10:00:00Z'), 1, 'MONTHS')).toEqual(new Date('2027-02-28T22:59:59.999Z'));
    expect(periodEnd(new Date('2027-08-31T10:00:00Z'), 1, 'MONTHS')).toEqual(new Date('2027-09-30T21:59:59.999Z'));
  });

  it('counts the Belgrade day the period starts on, not the UTC one', () => {
    // 23:30 UTC on 22. 10. is already 23. 10. in Belgrade.
    expect(periodEnd(new Date('2026-10-22T23:30:00Z'), 1, 'MONTHS')).toEqual(new Date('2026-11-23T22:59:59.999Z'));
  });

  it('ends a number of days later', () => {
    expect(periodEnd(new Date('2026-10-22T12:00:00Z'), 30, 'DAYS')).toEqual(new Date('2026-11-21T22:59:59.999Z'));
    expect(periodEnd(new Date('2026-10-22T12:00:00Z'), 1, 'DAYS')).toEqual(new Date('2026-10-23T21:59:59.999Z'));
  });

  it('extends an end already at the close of a day by whole days', () => {
    const end = periodEnd(new Date('2026-10-22T12:00:00Z'), 1, 'MONTHS');
    expect(periodEnd(end, 1, 'MONTHS')).toEqual(new Date('2026-12-22T22:59:59.999Z'));
  });
});

describe('grantBillingCycle', () => {
  it('files a year or more, or no end, as yearly', () => {
    expect(grantBillingCycle(11, 'MONTHS')).toBe('MONTHLY');
    expect(grantBillingCycle(12, 'MONTHS')).toBe('YEARLY');
    expect(grantBillingCycle(364, 'DAYS')).toBe('MONTHLY');
    expect(grantBillingCycle(365, 'DAYS')).toBe('YEARLY');
    expect(grantBillingCycle(null, null)).toBe('YEARLY');
  });
});
