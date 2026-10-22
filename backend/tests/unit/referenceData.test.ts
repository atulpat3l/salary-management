import { COUNTRIES, STRUCTURES, type StructureDefinition } from '../../prisma/seed/referenceData';
import { STRUCTURE_STYLES } from '../../src/domain/constants';
import { calculatePay, type StructureRules } from '../../src/domain/payCalculator';
import { usStandard } from '../fixtures/structures';

const toRules = (structure: StructureDefinition): StructureRules => ({
  ...structure,
  components: structure.components.map((c, index) => ({ ...c, sortOrder: index + 1 })),
});

/** A lowish but realistic annual base salary per country, in its own currency. */
const MODEST_ANNUAL_SALARY: Record<string, string> = {
  US: '30000',
  IN: '400000',
  GB: '24000',
  DE: '30000',
  CA: '35000',
  AU: '45000',
};

describe('reference data — supported countries (A4, FR-CUR-01)', () => {
  it('supports the six countries named in the PRD, each with exactly one currency', () => {
    expect(COUNTRIES.map((c) => [c.code, c.currencyCode])).toEqual([
      ['US', 'USD'],
      ['IN', 'INR'],
      ['GB', 'GBP'],
      ['DE', 'EUR'],
      ['CA', 'CAD'],
      ['AU', 'AUD'],
    ]);
  });

  it('has unique, well-formed codes and a locale for formatting amounts', () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.currencyCode).toMatch(/^[A-Z]{3}$/);
      expect(() => new Intl.NumberFormat(country.locale)).not.toThrow();
      // A4: every supported currency uses two decimal places.
      const format = new Intl.NumberFormat(country.locale, {
        style: 'currency',
        currency: country.currencyCode,
      });
      expect(format.resolvedOptions().maximumFractionDigits).toBe(2);
    }
  });
});

describe('reference data — salary structures (FR-STR-01)', () => {
  it('gives every supported country at least one structure', () => {
    for (const country of COUNTRIES) {
      expect(STRUCTURES.filter((s) => s.countryCode === country.code).length).toBeGreaterThan(0);
    }
  });

  it('only defines structures for supported countries', () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    expect(STRUCTURES.every((s) => codes.has(s.countryCode))).toBe(true);
  });

  it('uses at least three different styles across the system', () => {
    expect(new Set(STRUCTURES.map((s) => s.style))).toEqual(new Set(STRUCTURE_STYLES));
  });

  it('gives structures unique names, and components unique names within a structure', () => {
    expect(new Set(STRUCTURES.map((s) => s.name)).size).toBe(STRUCTURES.length);
    for (const structure of STRUCTURES) {
      const names = structure.components.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('matches the PRD "US Standard" example exactly', () => {
    const usStandardDefinition = STRUCTURES.find((s) => s.name === 'US Standard');
    expect(usStandardDefinition && toRules(usStandardDefinition)).toEqual({
      ...usStandard,
      name: 'US Standard',
      style: 'STANDARD',
      countryCode: 'US',
    });
  });

  it('makes the styles visibly different: Sales has the highest variable pay, Hourly the highest overtime', () => {
    for (const country of COUNTRIES) {
      const byStyle = Object.fromEntries(
        STRUCTURES.filter((s) => s.countryCode === country.code).map((s) => [s.style, s]),
      );
      expect(Number(byStyle.SALES.variableTargetPct)).toBeGreaterThan(
        Number(byStyle.STANDARD.variableTargetPct),
      );
      expect(Number(byStyle.HOURLY.overtimeMultiplier)).toBeGreaterThan(
        Number(byStyle.STANDARD.overtimeMultiplier),
      );
    }
  });

  it('never defines an earning as a % of gross (the calculator would reject it)', () => {
    const invalid = STRUCTURES.flatMap((s) =>
      s.components.filter((c) => c.kind === 'EARNING' && c.basis === 'PCT_GROSS'),
    );
    expect(invalid).toEqual([]);
  });

  it.each(STRUCTURES.map((s) => [s.name, s] as const))(
    '%s gives a positive net pay for a modest salary in its currency',
    (_name, structure) => {
      const result = calculatePay(toRules(structure), MODEST_ANNUAL_SALARY[structure.countryCode]);
      expect(result.flagged).toBe(false);
      expect(result.net.gt(0)).toBe(true);
    },
  );
});
