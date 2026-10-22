import { hashPassword } from '../../src/modules/auth/password';
import { prisma } from './db';

/** Password used by every factory-made account unless a test says otherwise. */
export const DEFAULT_PASSWORD = 'Passw0rd1';

let sequence = 0;
const next = () => ++sequence;

export async function createCountry(code = 'US') {
  const countries: Record<string, { name: string; currencyCode: string; locale: string }> = {
    US: { name: 'United States', currencyCode: 'USD', locale: 'en-US' },
    IN: { name: 'India', currencyCode: 'INR', locale: 'en-IN' },
    GB: { name: 'United Kingdom', currencyCode: 'GBP', locale: 'en-GB' },
  };
  return prisma.country.upsert({
    where: { code },
    update: {},
    create: { code, ...countries[code] },
  });
}

export async function createStructure(countryCode = 'US') {
  await createCountry(countryCode);
  return prisma.salaryStructure.create({
    data: {
      name: `${countryCode} Standard ${next()}`,
      style: 'STANDARD',
      countryCode,
      variableTargetPct: '10',
      standardMonthlyHours: 160,
      overtimeMultiplier: '1.5',
    },
  });
}

export async function createEmployee(
  overrides: { countryCode?: string; status?: 'ACTIVE' | 'INACTIVE'; fullName?: string } = {},
) {
  const countryCode = overrides.countryCode ?? 'US';
  const structure = await createStructure(countryCode);
  const n = next();
  return prisma.employee.create({
    data: {
      // "TST" so factory codes never clash with the API's generated "EMP#####" codes.
      employeeCode: `TST${String(n).padStart(5, '0')}`,
      fullName: overrides.fullName ?? `Test Employee ${n}`,
      jobTitle: 'Engineer',
      countryCode,
      annualBaseSalary: '60000.00',
      structureId: structure.id,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

interface AccountOptions {
  password?: string;
  mustChangePassword?: boolean;
}

export async function createHrAccount(options: AccountOptions = {}) {
  const account = await prisma.account.create({
    data: {
      loginId: `HR${String(next()).padStart(3, '0')}`,
      passwordHash: await hashPassword(options.password ?? DEFAULT_PASSWORD),
      role: 'HR',
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });
  return { account, password: options.password ?? DEFAULT_PASSWORD };
}

export async function createEmployeeAccount(
  options: AccountOptions & { status?: 'ACTIVE' | 'INACTIVE'; countryCode?: string } = {},
) {
  const employee = await createEmployee({
    status: options.status,
    countryCode: options.countryCode,
  });
  const account = await prisma.account.create({
    data: {
      loginId: employee.employeeCode,
      passwordHash: await hashPassword(options.password ?? DEFAULT_PASSWORD),
      role: 'EMPLOYEE',
      mustChangePassword: options.mustChangePassword ?? false,
      employeeId: employee.id,
    },
  });
  return { account, employee, password: options.password ?? DEFAULT_PASSWORD };
}
