import { lastDayOf, pastMonths } from '../../prisma/seed/seedDemoData';

describe('seed month helpers', () => {
  it('lists complete months before today, oldest first', () => {
    expect(pastMonths(new Date('2026-10-22T12:00:00Z'), 3)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
  });

  it('crosses year boundaries', () => {
    expect(pastMonths(new Date('2026-02-01T00:00:00Z'), 3)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });

  it.each([
    ['2026-01', '2026-01-31'],
    ['2026-02', '2026-02-28'],
    ['2024-02', '2024-02-29'],
    ['2026-04', '2026-04-30'],
    ['2026-12', '2026-12-31'],
  ])('the last day of %s is %s', (month, day) => {
    expect(lastDayOf(month)).toBe(day);
  });
});
