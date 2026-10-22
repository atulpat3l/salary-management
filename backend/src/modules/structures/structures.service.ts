import type { Prisma } from '../../generated/prisma/client';
import type { ComponentBasis, ComponentKind, StructureStyle } from '../../domain/constants';
import { AppError } from '../../lib/errors';
import { toMoney, type Money } from '../../lib/money';
import { prisma } from '../../lib/prisma';

const structureInclude = {
  country: true,
  components: { orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.SalaryStructureInclude;

export type StructureWithDetails = Prisma.SalaryStructureGetPayload<{
  include: typeof structureInclude;
}>;

/** FR-STR-01/02: the predefined structures, optionally only those of one country. */
export async function listStructures(countryCode?: string) {
  if (countryCode) await assertCountryExists(countryCode);

  const structures = await prisma.salaryStructure.findMany({
    where: countryCode ? { countryCode } : undefined,
    include: structureInclude,
    orderBy: [{ countryCode: 'asc' }, { name: 'asc' }],
  });
  return structures.map(toStructureView);
}

export async function getStructure(id: number) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id },
    include: structureInclude,
  });
  if (!structure) throw AppError.notFound('Salary structure not found');
  return toStructureView(structure);
}

async function assertCountryExists(code: string) {
  const country = await prisma.country.findUnique({ where: { code } });
  if (!country) {
    throw AppError.validation('Unknown country', { country: 'Not a supported country' });
  }
}

interface ComponentView {
  name: string;
  basis: ComponentBasis;
  percent: string | null; // for PCT_BASE / PCT_GROSS, e.g. "40"
  amount: Money | null; // for FIXED, always with the country's currency (FR-CUR-01)
}

/**
 * What HR sees about a structure. Earnings and deductions are split, percentages are plain
 * strings and fixed amounts carry their currency.
 */
export function toStructureView(structure: StructureWithDetails) {
  const currency = structure.country.currencyCode;
  const component = (kind: ComponentKind): ComponentView[] =>
    structure.components
      .filter((c) => c.kind === kind)
      .map((c) => ({
        name: c.name,
        basis: c.basis as ComponentBasis,
        percent: c.basis === 'FIXED' ? null : c.value.toString(),
        amount: c.basis === 'FIXED' ? toMoney(c.value, currency) : null,
      }));

  return {
    id: structure.id,
    name: structure.name,
    style: structure.style as StructureStyle,
    country: { code: structure.country.code, name: structure.country.name },
    currency,
    variableTargetPct: structure.variableTargetPct.toString(),
    standardMonthlyHours: structure.standardMonthlyHours,
    overtimeMultiplier: structure.overtimeMultiplier.toString(),
    earnings: component('EARNING'),
    deductions: component('DEDUCTION'),
  };
}
