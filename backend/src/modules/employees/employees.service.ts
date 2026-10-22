import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import type { EmployeeStatus, StructureStyle } from '../../domain/constants';
import { toPayBreakdown } from '../../domain/payBreakdown';
import { calculatePay } from '../../domain/payCalculator';
import { AppError, type FieldErrors } from '../../lib/errors';
import { toMoney } from '../../lib/money';
import { prisma } from '../../lib/prisma';
import { generateTemporaryPassword, hashPassword } from '../auth/password';
import { toStructureRules } from '../structures/structures.service';
import type {
  CreateEmployeeInput,
  ListEmployeesQuery,
  SalaryPreviewInput,
  UpdateEmployeeInput,
} from './employees.schema';

const employeeInclude = {
  country: true,
  structure: { include: { components: { orderBy: { sortOrder: 'asc' } } } },
} as const satisfies Prisma.EmployeeInclude;

type EmployeeWithDetails = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

/** Employee IDs are derived from the database id: 42 → "EMP00042" (A10). */
export function formatEmployeeCode(id: number): string {
  return `EMP${String(id).padStart(5, '0')}`;
}

/**
 * FR-EMP-01 + FR-AUTH-04: saves the employee and their login in one transaction and returns
 * the one-time temporary password. It is never stored or logged in readable form (NFR-06).
 */
export async function createEmployee(input: CreateEmployeeInput) {
  await assertStructureBelongsToCountry(input.structureId, input.countryCode);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const employee = await prisma.$transaction(async (tx) => {
    // The code depends on the new id, so insert with a unique placeholder and then set it.
    const created = await tx.employee.create({
      data: { ...input, employeeCode: `PENDING-${randomUUID()}` },
    });
    const employeeCode = formatEmployeeCode(created.id);
    await tx.account.create({
      data: {
        loginId: employeeCode,
        passwordHash,
        role: 'EMPLOYEE',
        mustChangePassword: true,
        employeeId: created.id,
      },
    });
    return tx.employee.update({
      where: { id: created.id },
      data: { employeeCode },
      include: employeeInclude,
    });
  });

  return { employee: toEmployeeDetail(employee), temporaryPassword };
}

/** FR-EMP-02 */
export async function getEmployee(id: number) {
  const employee = await prisma.employee.findUnique({ where: { id }, include: employeeInclude });
  if (!employee) throw AppError.notFound('Employee not found');
  return toEmployeeDetail(employee);
}

async function findEmployeeOrThrow(id: number) {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw AppError.notFound('Employee not found');
  return employee;
}

/**
 * FR-EMP-03: saves changes. Changing the country requires a new salary (in the new currency)
 * and a structure for the new country; the old amount is never converted. Payslips already
 * issued are snapshots, so they are not affected (FR-PAY-05).
 */
export async function updateEmployee(id: number, input: UpdateEmployeeInput) {
  const current = await findEmployeeOrThrow(id);
  const countryCode = input.countryCode ?? current.countryCode;

  if (countryCode !== current.countryCode) {
    const country = await prisma.country.findUnique({ where: { code: countryCode } });
    if (!country) {
      throw AppError.validation('Some fields are invalid', {
        countryCode: 'Not a supported country',
      });
    }
    const fields: FieldErrors = {};
    if (input.annualBaseSalary === undefined) {
      fields.annualBaseSalary = `Re-enter the annual base salary in ${country.currencyCode} for ${country.name}`;
    }
    if (input.structureId === undefined) {
      fields.structureId = `Choose a salary structure for ${country.name}`;
    }
    if (Object.keys(fields).length > 0) {
      throw AppError.validation(
        'Changing the country requires a new salary and salary structure',
        fields,
      );
    }
  }

  if (input.structureId !== undefined) {
    await assertStructureBelongsToCountry(input.structureId, countryCode);
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: input,
    include: employeeInclude,
  });
  return toEmployeeDetail(employee);
}

/**
 * FR-EMP-04: the employee is excluded from future payroll and insights and can no longer log
 * in; their open sessions end now. The record and its payroll history are kept.
 */
export async function deactivateEmployee(id: number) {
  const current = await findEmployeeOrThrow(id);
  if (current.status === 'INACTIVE') throw AppError.conflict('Employee is already inactive');

  const [employee] = await prisma.$transaction([
    prisma.employee.update({
      where: { id },
      data: { status: 'INACTIVE' },
      include: employeeInclude,
    }),
    prisma.session.deleteMany({ where: { account: { employeeId: id } } }),
  ]);
  return toEmployeeDetail(employee);
}

/**
 * FR-AUTH-06: issues a new one-time temporary password. The employee must change it on next
 * login (FR-AUTH-04), and any open sessions end.
 */
export async function resetEmployeePassword(id: number) {
  const current = await findEmployeeOrThrow(id);
  if (current.status === 'INACTIVE') {
    throw AppError.conflict('Cannot reset the password of a deactivated employee');
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.$transaction([
    prisma.account.update({
      where: { employeeId: id },
      data: { passwordHash, mustChangePassword: true },
    }),
    prisma.session.deleteMany({ where: { account: { employeeId: id } } }),
  ]);
  return { temporaryPassword };
}

/**
 * FR-EMP-01 / FR-EMP-05: the country must be supported and the structure must belong to it.
 * Returns both, so callers can use them without loading them again.
 */
async function assertStructureBelongsToCountry(structureId: number, countryCode: string) {
  const [country, structure] = await Promise.all([
    prisma.country.findUnique({ where: { code: countryCode } }),
    prisma.salaryStructure.findUnique({
      where: { id: structureId },
      include: employeeInclude.structure.include,
    }),
  ]);
  if (!country) {
    throw AppError.validation('Some fields are invalid', {
      countryCode: 'Not a supported country',
    });
  }
  if (!structure) {
    throw AppError.validation('Some fields are invalid', {
      structureId: 'Salary structure not found',
    });
  }
  if (structure.countryCode !== countryCode) {
    throw AppError.validation('Some fields are invalid', {
      structureId: `Choose a salary structure for ${country.name}`,
    });
  }
  return { country, structure };
}

/**
 * FR-FIND-01..04: one page of employees with the total count. Search, filters and sorting
 * apply to the whole list, not just the current page. The standard monthly salary is
 * calculated only for the rows on the page.
 */
export async function listEmployees(query: ListEmployeesQuery) {
  const { q, country, jobTitle, status, sort, order, page, pageSize } = query;

  const where: Prisma.EmployeeWhereInput = {
    // SQLite LIKE: case-insensitive for ASCII, partial match.
    ...(q && {
      OR: [{ fullName: { contains: q } }, { employeeCode: { contains: q.toUpperCase() } }],
    }),
    ...(country && { countryCode: country }),
    ...(jobTitle && { jobTitle }),
    ...(status && { status }),
  };

  // The id breaks ties so paging is stable. Employee IDs follow the id, so sorting by
  // "employeeCode" uses it directly (and stays correct past EMP99999).
  const orderBy: Prisma.EmployeeOrderByWithRelationInput[] = {
    employeeCode: [{ id: order }],
    name: [{ fullName: order }, { id: 'asc' as const }],
    salary: [{ annualBaseSalary: order }, { id: 'asc' as const }],
  }[sort];

  const [total, employees] = await prisma.$transaction([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: employeeInclude,
    }),
  ]);

  return {
    items: employees.map(toEmployeeListItem),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * FR-EMP-06: the standard monthly salary for values not saved yet, so the add/edit form can
 * show it as HR types. Nothing is stored.
 */
export async function previewStandardSalary(input: SalaryPreviewInput) {
  const { country, structure } = await assertStructureBelongsToCountry(
    input.structureId,
    input.countryCode,
  );
  const pay = calculatePay(toStructureRules(structure), input.annualBaseSalary);
  return {
    currency: country.currencyCode,
    standardMonthlySalary: toPayBreakdown(pay, country.currencyCode),
  };
}

/** The job titles in use, for the list filter and for suggestions during entry (PRD Q4). */
export async function listJobTitles(countryCode?: string) {
  const rows = await prisma.employee.findMany({
    where: countryCode ? { countryCode } : undefined,
    distinct: ['jobTitle'],
    select: { jobTitle: true },
    orderBy: { jobTitle: 'asc' },
  });
  return rows.map((row) => row.jobTitle);
}

/** One row of the employee list (FR-FIND-01): every amount with its currency. */
function toEmployeeListItem(employee: EmployeeWithDetails) {
  const currency = employee.country.currencyCode;
  const standardPay = calculatePay(toStructureRules(employee.structure), employee.annualBaseSalary);
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    jobTitle: employee.jobTitle,
    country: { code: employee.country.code, name: employee.country.name },
    currency,
    annualBaseSalary: toMoney(employee.annualBaseSalary, currency),
    standardMonthlyGross: toMoney(standardPay.gross, currency),
    standardMonthlyNet: toMoney(standardPay.net, currency),
    status: employee.status as EmployeeStatus,
  };
}

/**
 * Everything HR sees about one employee. The currency always comes from the country
 * (FR-CUR-01), and the standard monthly salary is recalculated on every read, so it is never
 * out of date (FR-EMP-06).
 */
function toEmployeeDetail(employee: EmployeeWithDetails) {
  const currency = employee.country.currencyCode;
  const standardPay = calculatePay(toStructureRules(employee.structure), employee.annualBaseSalary);

  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    jobTitle: employee.jobTitle,
    country: { code: employee.country.code, name: employee.country.name },
    currency,
    annualBaseSalary: toMoney(employee.annualBaseSalary, currency),
    structure: {
      id: employee.structure.id,
      name: employee.structure.name,
      style: employee.structure.style as StructureStyle,
    },
    status: employee.status as EmployeeStatus,
    standardMonthlySalary: toPayBreakdown(standardPay, currency),
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
