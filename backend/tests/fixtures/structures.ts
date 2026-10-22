import type { StructureRules } from '../../src/domain/payCalculator';

/** The "US Standard" structure from PRD §5.5 / §5.7, used by the worked examples. */
export const usStandard: StructureRules = {
  variableTargetPct: '10',
  standardMonthlyHours: 160,
  overtimeMultiplier: '1.5',
  components: [
    { kind: 'EARNING', name: 'Housing allowance', basis: 'PCT_BASE', value: '40', sortOrder: 1 },
    { kind: 'EARNING', name: 'Transport allowance', basis: 'FIXED', value: '200', sortOrder: 2 },
    { kind: 'DEDUCTION', name: 'Income tax', basis: 'PCT_GROSS', value: '20', sortOrder: 3 },
    { kind: 'DEDUCTION', name: 'Retirement', basis: 'PCT_BASE', value: '5', sortOrder: 4 },
    { kind: 'DEDUCTION', name: 'Health insurance', basis: 'FIXED', value: '100', sortOrder: 5 },
  ],
};

/** A structure with no components, no variable pay — handy for isolating one rule at a time. */
export function bareStructure(overrides: Partial<StructureRules> = {}): StructureRules {
  return {
    variableTargetPct: '0',
    standardMonthlyHours: 160,
    overtimeMultiplier: '1.5',
    components: [],
    ...overrides,
  };
}
