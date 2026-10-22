/**
 * Demo data (FR-DATA-01): ~10,000 fictional employees, their logins, and a few months of
 * finalised and paid payroll. Deterministic (fixed faker seed) and repeatable: every run first
 * clears the previous demo data, so the system always resets to the same known state.
 */
import { randomBytes } from 'node:crypto';
import {
  faker,
  fakerDE,
  fakerEN_AU,
  fakerEN_CA,
  fakerEN_GB,
  fakerEN_IN,
  fakerEN_US,
  type Faker,
} from '@faker-js/faker';
import type { StructureStyle } from '../../src/domain/constants';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/modules/auth/password';
import { formatEmployeeCode } from '../../src/modules/employees/employees.service';
import {
  createRun,
  disburseRun,
  finaliseRun,
  saveInputs,
} from '../../src/modules/payroll/payroll.service';

const FAKER_SEED = 20261022;

/** Known logins for trying the employee experience (documented in the README). */
export const DEMO_EMPLOYEE_PASSWORD = 'Welcome2026';
export const DEMO_EMPLOYEES = [
  {
    fullName: 'Emily Carter',
    countryCode: 'US',
    jobTitle: 'Software Engineer',
    annualBaseSalary: '60000.00',
  },
  {
    fullName: 'Asha Rao',
    countryCode: 'IN',
    jobTitle: 'Data Analyst',
    annualBaseSalary: '1800000.00',
  },
  {
    fullName: 'Oliver Bennett',
    countryCode: 'GB',
    jobTitle: 'Sales Executive',
    annualBaseSalary: '42000.00',
  },
  {
    fullName: 'Lena Fischer',
    countryCode: 'DE',
    jobTitle: 'Operations Technician',
    annualBaseSalary: '38000.00',
  },
] as const;

interface CountryProfile {
  faker: Faker;
  /** Share of the workforce. */
  weight: number;
  /** Typical annual base salary of a mid-level role, in the country's currency. */
  typicalSalary: number;
  /** Salaries are rounded to this step (e.g. INR to the nearest 1,000). */
  roundTo: number;
}

const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  US: { faker: fakerEN_US, weight: 30, typicalSalary: 85_000, roundTo: 100 },
  IN: { faker: fakerEN_IN, weight: 30, typicalSalary: 1_400_000, roundTo: 1_000 },
  GB: { faker: fakerEN_GB, weight: 12, typicalSalary: 50_000, roundTo: 100 },
  DE: { faker: fakerDE, weight: 10, typicalSalary: 58_000, roundTo: 100 },
  CA: { faker: fakerEN_CA, weight: 9, typicalSalary: 75_000, roundTo: 100 },
  AU: { faker: fakerEN_AU, weight: 9, typicalSalary: 90_000, roundTo: 100 },
};

/** Job titles with a salary factor relative to the country's typical salary, and a structure style. */
const JOB_TITLES: { title: string; factor: number; style: StructureStyle; weight: number }[] = [
  { title: 'Software Engineer', factor: 1.0, style: 'STANDARD', weight: 18 },
  { title: 'Senior Software Engineer', factor: 1.35, style: 'STANDARD', weight: 10 },
  { title: 'Engineering Manager', factor: 1.7, style: 'STANDARD', weight: 4 },
  { title: 'Product Manager', factor: 1.4, style: 'STANDARD', weight: 5 },
  { title: 'Data Analyst', factor: 0.85, style: 'STANDARD', weight: 8 },
  { title: 'Designer', factor: 0.9, style: 'STANDARD', weight: 5 },
  { title: 'Finance Analyst', factor: 0.85, style: 'STANDARD', weight: 5 },
  { title: 'HR Specialist', factor: 0.75, style: 'STANDARD', weight: 4 },
  { title: 'Sales Executive', factor: 0.75, style: 'SALES', weight: 12 },
  { title: 'Account Manager', factor: 0.95, style: 'SALES', weight: 7 },
  { title: 'Customer Support Associate', factor: 0.5, style: 'HOURLY', weight: 12 },
  { title: 'Operations Technician', factor: 0.55, style: 'HOURLY', weight: 10 },
];

interface SeedEmployee {
  id: number;
  fullName: string;
  countryCode: string;
  jobTitle: string;
  annualBaseSalary: string;
  status: 'ACTIVE' | 'INACTIVE';
}

/** About 1 in 30 employees has left (inactive), so deactivation is visible in the data. */
const INACTIVE_SHARE = 1 / 30;
/** Share of employees with overtime, bonus or a non-100% achievement in a payroll month. */
const INPUT_SHARE = 0.2;

export interface SeedDemoOptions {
  employeeCount?: number;
  /** How many past months of finalised and paid payroll to create. */
  payrollMonths?: number;
  /** "Today", for working out which months are in the past. */
  today?: Date;
}

export async function seedDemoData({
  employeeCount = 10_000,
  payrollMonths = 3,
  today = new Date(),
}: SeedDemoOptions = {}) {
  // Each country's name generator gets its own seed: the English locales share name lists, so
  // equal seeds would give the same people in the US, UK, Canada and Australia.
  Object.values(COUNTRY_PROFILES).forEach((profile, index) =>
    profile.faker.seed(FAKER_SEED + index + 1),
  );
  const random = faker; // a separate stream for every non-name choice
  random.seed(FAKER_SEED);

  await clearDemoData();

  const structures = await prisma.salaryStructure.findMany();
  const structureId = (countryCode: string, style: StructureStyle) =>
    structures.find((s) => s.countryCode === countryCode && s.style === style)!.id;
  const styleOfTitle = new Map(JOB_TITLES.map((t) => [t.title, t.style]));

  // Demo employees come first, so their Employee IDs are always EMP00001..EMP00004.
  const employees: SeedEmployee[] = DEMO_EMPLOYEES.map((demo, index) => ({
    ...demo,
    id: index + 1,
    status: 'ACTIVE',
  }));

  const countryCodes = Object.keys(COUNTRY_PROFILES);
  const countryWeights = countryCodes.map((code) => ({
    value: code,
    weight: COUNTRY_PROFILES[code].weight,
  }));
  const titleWeights = JOB_TITLES.map((t) => ({ value: t, weight: t.weight }));

  for (let id = employees.length + 1; id <= employeeCount; id++) {
    const countryCode = random.helpers.weightedArrayElement(countryWeights);
    const profile = COUNTRY_PROFILES[countryCode];
    const job = random.helpers.weightedArrayElement(titleWeights);
    const spread = random.number.float({ min: 0.8, max: 1.25 });
    const salary =
      Math.round((profile.typicalSalary * job.factor * spread) / profile.roundTo) * profile.roundTo;
    employees.push({
      id,
      // First and last name only: fullName() sometimes adds titles such as "Mr." or "Dr.".
      fullName: `${profile.faker.person.firstName()} ${profile.faker.person.lastName()}`,
      countryCode,
      jobTitle: job.title,
      annualBaseSalary: salary.toFixed(2),
      status: random.number.float() < INACTIVE_SHARE ? 'INACTIVE' : 'ACTIVE',
    });
  }

  await prisma.employee.createMany({
    data: employees.map((e) => ({
      id: e.id,
      employeeCode: formatEmployeeCode(e.id),
      fullName: e.fullName,
      jobTitle: e.jobTitle,
      countryCode: e.countryCode,
      annualBaseSalary: e.annualBaseSalary,
      structureId: structureId(e.countryCode, styleOfTitle.get(e.jobTitle)!),
      status: e.status,
    })),
  });

  // Hashing 10,000 passwords one by one would take minutes, so two hashes are shared:
  // the documented demo password, and a random one nobody knows (HR can reset any of them).
  const demoHash = await hashPassword(DEMO_EMPLOYEE_PASSWORD);
  const unknownHash = await hashPassword(randomBytes(24).toString('base64url'));
  await prisma.account.createMany({
    data: employees.map((e, index) => {
      const isDemo = index < DEMO_EMPLOYEES.length;
      return {
        loginId: formatEmployeeCode(e.id),
        passwordHash: isDemo ? demoHash : unknownHash,
        role: 'EMPLOYEE',
        mustChangePassword: !isDemo,
        employeeId: e.id,
      };
    }),
  });

  const activeIds = employees.filter((e) => e.status === 'ACTIVE').map((e) => e.id);
  const months = pastMonths(today, payrollMonths);
  for (const month of months) {
    const run = await createRun(month);
    const withInputs = activeIds.filter(
      (employeeId) => employeeId > DEMO_EMPLOYEES.length && random.number.float() < INPUT_SHARE,
    );
    if (withInputs.length > 0) {
      await saveInputs(
        run.id,
        withInputs.map((employeeId) => ({
          employeeId,
          overtimeHours: String(random.helpers.arrayElement([0, 0, 4, 8, 12, 20])),
          bonus: String(random.helpers.arrayElement([0, 0, 0, 250, 500, 1000])),
          achievementPct: String(random.helpers.arrayElement([80, 90, 100, 100, 110, 125])),
        })),
      );
    }
    await finaliseRun(run.id);
    await disburseRun(run.id, lastDayOf(month));
  }

  return {
    employees: employees.length,
    active: activeIds.length,
    payrollMonths: months,
  };
}

/** Removes previous demo data (everything except countries, structures and HR logins). */
async function clearDemoData() {
  await prisma.$transaction([
    prisma.payslipLine.deleteMany(),
    prisma.payslip.deleteMany(),
    prisma.payrollInput.deleteMany(),
    prisma.payrollRun.deleteMany(),
    prisma.session.deleteMany({ where: { account: { role: 'EMPLOYEE' } } }),
    prisma.account.deleteMany({ where: { role: 'EMPLOYEE' } }),
    prisma.employee.deleteMany(),
  ]);
}

/** The `count` complete months before today's month, oldest first, e.g. ["2026-07", …]. */
export function pastMonths(today: Date, count: number): string[] {
  const months: string[] = [];
  for (let back = count; back >= 1; back--) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

/** "2026-02" → "2026-02-28". */
export function lastDayOf(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}
