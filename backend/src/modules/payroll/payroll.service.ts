import { Prisma, type PayrollRun } from '../../generated/prisma/client';
import { STANDARD_INPUTS } from '../../domain/payCalculator';
import type { PayrollStatus } from '../../domain/constants';
import { AppError, type FieldErrors } from '../../lib/errors';
import { toMoney } from '../../lib/money';
import { prisma } from '../../lib/prisma';
import type { MonthlyInput } from './payroll.schema';

/** FR-PAY-04: at most one run per month (enforced by the unique month column). */
export async function createRun(month: string) {
  try {
    return toRunView(await prisma.payrollRun.create({ data: { month } }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflict(`A payroll run for ${month} already exists`);
    }
    throw error;
  }
}

/** All runs, newest month first. */
export async function listRuns() {
  const runs = await prisma.payrollRun.findMany({ orderBy: { month: 'desc' } });
  return runs.map(toRunView);
}

export async function getRun(id: number) {
  return toRunView(await findRunOrThrow(id));
}

/**
 * FR-PAY-01: records employees' inputs for the month, all or nothing. Each item replaces that
 * employee's previous inputs; a field left out takes its default. Only active employees are paid.
 */
export async function saveInputs(runId: number, inputs: MonthlyInput[]) {
  const run = await findRunOrThrow(runId);
  assertDraft(run, 'Monthly inputs can only be changed while the payroll run is a draft');

  const employees = await prisma.employee.findMany({
    where: { id: { in: inputs.map((input) => input.employeeId) } },
    select: { id: true, status: true },
  });
  const statusById = new Map(employees.map((e) => [e.id, e.status]));

  const fields: FieldErrors = {};
  inputs.forEach((input, index) => {
    const status = statusById.get(input.employeeId);
    if (!status) fields[`inputs.${index}.employeeId`] = 'Employee not found';
    else if (status === 'INACTIVE') {
      fields[`inputs.${index}.employeeId`] = 'Employee is inactive and not included in payroll';
    }
  });
  if (Object.keys(fields).length > 0) throw AppError.validation('Some inputs are invalid', fields);

  await prisma.$transaction(
    inputs.map((input) => {
      const values = {
        overtimeHours: input.overtimeHours ?? String(STANDARD_INPUTS.overtimeHours),
        bonus: input.bonus ?? String(STANDARD_INPUTS.bonus),
        achievementPct: input.achievementPct ?? String(STANDARD_INPUTS.achievementPct),
      };
      return prisma.payrollInput.upsert({
        where: { runId_employeeId: { runId, employeeId: input.employeeId } },
        create: { runId, employeeId: input.employeeId, ...values },
        update: values,
      });
    }),
  );
  return { saved: inputs.length };
}

/** The inputs entered so far for a run. Employees without a row use the defaults. */
export async function listInputs(runId: number) {
  await findRunOrThrow(runId);
  const inputs = await prisma.payrollInput.findMany({
    where: { runId },
    include: { employee: { include: { country: true } } },
    orderBy: { employeeId: 'asc' },
  });
  return inputs.map((input) => ({
    employeeId: input.employeeId,
    employeeCode: input.employee.employeeCode,
    fullName: input.employee.fullName,
    overtimeHours: input.overtimeHours.toString(),
    bonus: toMoney(input.bonus, input.employee.country.currencyCode),
    achievementPct: input.achievementPct.toString(),
  }));
}

async function findRunOrThrow(id: number) {
  const run = await prisma.payrollRun.findUnique({ where: { id } });
  if (!run) throw AppError.notFound('Payroll run not found');
  return run;
}

function assertDraft(run: PayrollRun, message: string) {
  if (run.status !== 'DRAFT') throw AppError.conflict(message);
}

function toRunView(run: PayrollRun) {
  return {
    id: run.id,
    month: run.month,
    status: run.status as PayrollStatus,
    calculatedAt: run.calculatedAt,
    finalisedAt: run.finalisedAt,
    disbursedAt: run.disbursedAt,
    paymentDate: run.paymentDate && run.paymentDate.toISOString().slice(0, 10),
    createdAt: run.createdAt,
  };
}
