import { getReviewDeadline, getReviewEditableUntil } from './review-window';
import { belgradeDayStart, endOfBelgradeDayAfter } from './timezone';

describe('review windows (Dizajn 43)', () => {
  it('ends a window at the end of its last Belgrade day, in summer time', () => {
    // 21. 9. 12:00 Belgrade (UTC+2): the 7th day after is 28. 9.
    expect(getReviewEditableUntil(new Date('2026-09-21T10:00:00Z'), 7)).toEqual(new Date('2026-09-28T21:59:59.999Z'));
    expect(getReviewDeadline(new Date('2026-09-20T09:05:00Z'), 14)).toEqual(new Date('2026-10-04T21:59:59.999Z'));
  });

  it('counts from the Belgrade day, not the UTC one', () => {
    // 22:30 UTC on 21. 9. is already 22. 9. in Belgrade.
    expect(endOfBelgradeDayAfter(new Date('2026-09-21T22:30:00Z'), 7)).toEqual(new Date('2026-09-29T21:59:59.999Z'));
    // 23:30 Belgrade on 21. 9. still belongs to 21. 9.
    expect(endOfBelgradeDayAfter(new Date('2026-09-21T21:30:00Z'), 7)).toEqual(new Date('2026-09-28T21:59:59.999Z'));
  });

  it('crosses the change to winter time (25. 10. 2026) and the turn of the year', () => {
    // 20. 10. is on UTC+2, 27. 10. on UTC+1.
    expect(endOfBelgradeDayAfter(new Date('2026-10-20T10:00:00Z'), 7)).toEqual(new Date('2026-10-27T22:59:59.999Z'));
    expect(endOfBelgradeDayAfter(new Date('2026-12-28T10:00:00Z'), 7)).toEqual(new Date('2027-01-04T22:59:59.999Z'));
    // and back to summer time on 28. 3. 2027
    expect(endOfBelgradeDayAfter(new Date('2027-03-25T10:00:00Z'), 7)).toEqual(new Date('2027-04-01T21:59:59.999Z'));
  });

  it("finds a Belgrade midnight on either offset, the change days included", () => {
    expect(belgradeDayStart(2026, 7, 1)).toEqual(new Date('2026-06-30T22:00:00Z'));
    expect(belgradeDayStart(2026, 1, 1)).toEqual(new Date('2025-12-31T23:00:00Z'));
    expect(belgradeDayStart(2026, 10, 25)).toEqual(new Date('2026-10-24T22:00:00Z'));
    expect(belgradeDayStart(2026, 10, 26)).toEqual(new Date('2026-10-25T23:00:00Z'));
    expect(belgradeDayStart(2027, 3, 28)).toEqual(new Date('2027-03-27T23:00:00Z'));
    expect(belgradeDayStart(2027, 3, 29)).toEqual(new Date('2027-03-28T22:00:00Z'));
  });
});
