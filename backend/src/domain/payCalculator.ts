import type { ComponentBasis, ComponentKind } from './constants';
import { Decimal, round2, toDecimal, type DecimalLike } from '../lib/money';


export interface StructureComponentRule {
  kind: ComponentKind;
  name: string;
  basis: ComponentBasis;
  value: DecimalLike; // a percentage for PCT_*, an amount for FIXED
  sortOrder: number;
}

export interface StructureRules {
  variableTargetPct: DecimalLike;
  standardMonthlyHours: number;
  overtimeMultiplier: DecimalLike;
  components: StructureComponentRule[];
}

export interface MonthlyInputs {
  overtimeHours: DecimalLike;
  bonus: DecimalLike;
  achievementPct: DecimalLike;
}

/** No overtime, no bonus, 100% variable pay achievement */
export const STANDARD_INPUTS: Readonly<MonthlyInputs> = Object.freeze({
  overtimeHours: 0,
  bonus: 0,
  achievementPct: 100,
});

export const MAX_ACHIEVEMENT_PCT = 200;

export type PayLineKind = 'BASE' | 'EARNING' | 'VARIABLE' | 'OVERTIME' | 'BONUS' | 'DEDUCTION';

export interface PayLine {
  kind: PayLineKind;
  label: string;
  calculation: string; // how the amount was worked out, e.g. "40% × 5000.00"
  amount: Decimal; // already rounded to 2 dp
}

export interface PayResult {
  earnings: PayLine[];
  deductions: PayLine[];
  gross: Decimal;
  totalDeductions: Decimal;
  net: Decimal;
  flagged: boolean; // deductions exceed gross pay — must be reviewed before finalising
}

export function calculatePay(
  structure: StructureRules,
  annualBaseSalary: DecimalLike,
  inputs: MonthlyInputs = STANDARD_INPUTS,
): PayResult {
  const annualBase = toDecimal(annualBaseSalary);
  const overtimeHours = toDecimal(inputs.overtimeHours);
  const bonus = toDecimal(inputs.bonus);
  const achievementPct = toDecimal(inputs.achievementPct);
  assertValid(structure, annualBase, overtimeHours, bonus, achievementPct);

  const components = [...structure.components].sort((a, b) => a.sortOrder - b.sortOrder);
  const monthlyBase = round2(annualBase.div(12));

  const earnings: PayLine[] = [
    {
      kind: 'BASE',
      label: 'Monthly base',
      calculation: `${annualBase.toFixed(2)} ÷ 12`,
      amount: monthlyBase,
    },
  ];

  for (const component of components.filter((c) => c.kind === 'EARNING')) {
    earnings.push({
      kind: 'EARNING',
      label: component.name,
      ...applyBasis(component, monthlyBase),
    });
  }

  const variableTargetPct = toDecimal(structure.variableTargetPct);
  if (variableTargetPct.gt(0)) {
    earnings.push({
      kind: 'VARIABLE',
      label: 'Variable pay',
      calculation: `${monthlyBase.toFixed(2)} × ${variableTargetPct}% × ${achievementPct}%`,
      amount: round2(monthlyBase.mul(variableTargetPct).mul(achievementPct).div(10_000)),
    });
  }

  if (overtimeHours.gt(0)) {
    const multiplier = toDecimal(structure.overtimeMultiplier);
    earnings.push({
      kind: 'OVERTIME',
      label: 'Overtime',
      calculation: `(${monthlyBase.toFixed(2)} ÷ ${structure.standardMonthlyHours}) × ${multiplier} × ${overtimeHours} h`,
      amount: round2(
        monthlyBase.div(structure.standardMonthlyHours).mul(multiplier).mul(overtimeHours),
      ),
    });
  }

  if (bonus.gt(0)) {
    earnings.push({ kind: 'BONUS', label: 'Bonus', calculation: 'entered', amount: round2(bonus) });
  }

  const gross = sumLines(earnings);

  const deductions: PayLine[] = components
    .filter((c) => c.kind === 'DEDUCTION')
    .map((component) => ({
      kind: 'DEDUCTION',
      label: component.name,
      ...applyBasis(component, monthlyBase, gross),
    }));

  const totalDeductions = sumLines(deductions);
  const net = gross.minus(totalDeductions);

  return { earnings, deductions, gross, totalDeductions, net, flagged: net.lt(0) };
}

/** Works out one component. `gross` is only known (and only allowed) for deductions. */
function applyBasis(
  component: StructureComponentRule,
  monthlyBase: Decimal,
  gross?: Decimal,
): Pick<PayLine, 'calculation' | 'amount'> {
  const value = toDecimal(component.value);
  switch (component.basis) {
    case 'PCT_BASE':
      return percentOf(value, monthlyBase);
    case 'PCT_GROSS':
      if (!gross) throw new Error(`Earning "${component.name}" cannot be a % of gross pay`);
      return percentOf(value, gross);
    case 'FIXED':
      return { calculation: 'fixed', amount: round2(value) };
  }
}

function percentOf(percent: Decimal, of: Decimal) {
  return {
    calculation: `${percent}% × ${of.toFixed(2)}`,
    amount: round2(of.mul(percent).div(100)),
  };
}

/** Lines are already rounded, so their sum is exact and always equals the total shown. */
function sumLines(lines: PayLine[]): Decimal {
  return lines.reduce((total, line) => total.plus(line.amount), new Decimal(0));
}

function assertValid(
  structure: StructureRules,
  annualBase: Decimal,
  overtimeHours: Decimal,
  bonus: Decimal,
  achievementPct: Decimal,
) {
  if (annualBase.lte(0)) throw new RangeError('Annual base salary must be greater than zero');
  if (structure.standardMonthlyHours <= 0) {
    throw new RangeError('Standard monthly hours must be greater than zero');
  }
  if (overtimeHours.lt(0)) throw new RangeError('Overtime hours cannot be negative');
  if (bonus.lt(0)) throw new RangeError('Bonus cannot be negative');
  if (achievementPct.lt(0) || achievementPct.gt(MAX_ACHIEVEMENT_PCT)) {
    throw new RangeError(`Achievement must be between 0% and ${MAX_ACHIEVEMENT_PCT}%`);
  }
}
