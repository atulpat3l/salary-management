/**
 * Supported countries (A4) and their predefined salary structures (FR-STR-01, A11).
 * All values are fictional but sized realistically for each currency.
 * Percentages are plain numbers ("40" = 40%); fixed amounts are monthly, in the country's currency.
 */
import type { ComponentBasis, ComponentKind, StructureStyle } from '../../src/domain/constants';

export interface CountryDefinition {
  code: string;
  name: string;
  currencyCode: string;
  locale: string;
}

export interface ComponentDefinition {
  kind: ComponentKind;
  name: string;
  basis: ComponentBasis;
  value: string;
}

export interface StructureDefinition {
  name: string;
  style: StructureStyle;
  countryCode: string;
  variableTargetPct: string;
  standardMonthlyHours: number;
  overtimeMultiplier: string;
  components: ComponentDefinition[]; // in display order
}

export const COUNTRIES: CountryDefinition[] = [
  { code: 'US', name: 'United States', currencyCode: 'USD', locale: 'en-US' },
  { code: 'IN', name: 'India', currencyCode: 'INR', locale: 'en-IN' },
  { code: 'GB', name: 'United Kingdom', currencyCode: 'GBP', locale: 'en-GB' },
  { code: 'DE', name: 'Germany', currencyCode: 'EUR', locale: 'de-DE' },
  { code: 'CA', name: 'Canada', currencyCode: 'CAD', locale: 'en-CA' },
  { code: 'AU', name: 'Australia', currencyCode: 'AUD', locale: 'en-AU' },
];

/** The per-country numbers that differ; the three styles below are built from them. */
interface CountryPayRules {
  countryCode: string;
  standardMonthlyHours: number;
  transportAllowance: string; // fixed, monthly
  healthInsurance: string; // fixed, monthly
  incomeTaxPctOfGross: string;
  retirementPctOfBase: string;
}

const COUNTRY_PAY_RULES: CountryPayRules[] = [
  // US values match the "US Standard" example in PRD §5.5 / §5.7.
  {
    countryCode: 'US',
    standardMonthlyHours: 160,
    transportAllowance: '200',
    healthInsurance: '100',
    incomeTaxPctOfGross: '20',
    retirementPctOfBase: '5',
  },
  {
    countryCode: 'IN',
    standardMonthlyHours: 192,
    transportAllowance: '3200',
    healthInsurance: '1500',
    incomeTaxPctOfGross: '15',
    retirementPctOfBase: '12',
  },
  {
    countryCode: 'GB',
    standardMonthlyHours: 163,
    transportAllowance: '150',
    healthInsurance: '60',
    incomeTaxPctOfGross: '20',
    retirementPctOfBase: '5',
  },
  {
    countryCode: 'DE',
    standardMonthlyHours: 168,
    transportAllowance: '120',
    healthInsurance: '90',
    incomeTaxPctOfGross: '25',
    retirementPctOfBase: '9.3',
  },
  {
    countryCode: 'CA',
    standardMonthlyHours: 160,
    transportAllowance: '180',
    healthInsurance: '90',
    incomeTaxPctOfGross: '20',
    retirementPctOfBase: '5.95',
  },
  {
    countryCode: 'AU',
    standardMonthlyHours: 152,
    transportAllowance: '170',
    healthInsurance: '85',
    incomeTaxPctOfGross: '22',
    retirementPctOfBase: '5',
  },
];

function deductions(rules: CountryPayRules): ComponentDefinition[] {
  return [
    { kind: 'DEDUCTION', name: 'Income tax', basis: 'PCT_GROSS', value: rules.incomeTaxPctOfGross },
    { kind: 'DEDUCTION', name: 'Retirement', basis: 'PCT_BASE', value: rules.retirementPctOfBase },
    { kind: 'DEDUCTION', name: 'Health insurance', basis: 'FIXED', value: rules.healthInsurance },
  ];
}

/** Standard: balanced allowances, modest variable pay. */
function standard(rules: CountryPayRules): StructureDefinition {
  return {
    name: `${rules.countryCode} Standard`,
    style: 'STANDARD',
    countryCode: rules.countryCode,
    variableTargetPct: '10',
    standardMonthlyHours: rules.standardMonthlyHours,
    overtimeMultiplier: '1.5',
    components: [
      { kind: 'EARNING', name: 'Housing allowance', basis: 'PCT_BASE', value: '40' },
      {
        kind: 'EARNING',
        name: 'Transport allowance',
        basis: 'FIXED',
        value: rules.transportAllowance,
      },
      ...deductions(rules),
    ],
  };
}

/** Sales: lower fixed allowances, much higher variable pay. */
function sales(rules: CountryPayRules): StructureDefinition {
  return {
    name: `${rules.countryCode} Sales`,
    style: 'SALES',
    countryCode: rules.countryCode,
    variableTargetPct: '30',
    standardMonthlyHours: rules.standardMonthlyHours,
    overtimeMultiplier: '1.5',
    components: [
      { kind: 'EARNING', name: 'Housing allowance', basis: 'PCT_BASE', value: '20' },
      {
        kind: 'EARNING',
        name: 'Transport allowance',
        basis: 'FIXED',
        value: rules.transportAllowance,
      },
      ...deductions(rules),
    ],
  };
}

/** Hourly-heavy: no variable pay, a shift allowance and a higher overtime multiplier. */
function hourly(rules: CountryPayRules): StructureDefinition {
  return {
    name: `${rules.countryCode} Hourly`,
    style: 'HOURLY',
    countryCode: rules.countryCode,
    variableTargetPct: '0',
    standardMonthlyHours: rules.standardMonthlyHours,
    overtimeMultiplier: '2',
    components: [
      { kind: 'EARNING', name: 'Shift allowance', basis: 'PCT_BASE', value: '10' },
      {
        kind: 'EARNING',
        name: 'Transport allowance',
        basis: 'FIXED',
        value: rules.transportAllowance,
      },
      ...deductions(rules),
    ],
  };
}

export const STRUCTURES: StructureDefinition[] = COUNTRY_PAY_RULES.flatMap((rules) => [
  standard(rules),
  sales(rules),
  hourly(rules),
]);
