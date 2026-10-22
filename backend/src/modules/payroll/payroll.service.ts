import { Prisma, type PayrollRun } from '../../generated/prisma/client';
import { STANDARD_INPUTS } from '../../domain/payCalculator';
import type { PayrollStatus } from '../../domain/constants';
import { bulkInsert } from '../../lib/bulkInsert';
import { AppError, type FieldErrors } from '../../lib/errors';
import { toMoney } from '../../lib/money';
import { prisma } from '../../lib/prisma';
import { toPayslipDetail, toPayslipSummary } from '../payslips/payslip.view';
import { toStructureRules } from '../structures/structures.service';
import { draftPayslip, summariseByCountry } from './payroll.calculation';
import type { ListRunPayslipsQuery, MonthlyInput } from './payroll.schema';

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

/** FR-PAY-03: the run with its headcount and per-country totals (once calculated). */
export async function getRun(id: number) {
  const run = await findRunOrThrow(id);
  const payslips = await prisma.payslip.findMany({
    where: { runId: id },
    select: {
      countryCode: true,
      countryName: true,
      currency: true,
      gross: true,
      totalDeductions: true,
      net: true,
      flagged: true,
    },
  });
  return { ...toRunView(run), summary: summariseByCountry(payslips) };
}

/** Large enough for ~10,000 employees in one transaction (NFR-02). */
const PAYROLL_TRANSACTION_TIMEOUT_MS = 120_000;

/**
 * FR-PAY-02: calculates every active employee's pay for the month and replaces the draft
 * payslips, all in one transaction. Can be repeated while the run is a draft, e.g. after
 * inputs or employee details change.
 */
export async function calculateRun(id: number) {
  const run = await findRunOrThrow(id);
  assertDraft(run, 'Only a draft payroll run can be calculated');

  await prisma.$transaction(
    async (tx) => {
      await writeDraftPayslips(tx, id);
      await tx.payrollRun.update({ where: { id }, data: { calculatedAt: new Date() } });
    },
    { timeout: PAYROLL_TRANSACTION_TIMEOUT_MS },
  );
  return getRun(id);
}

/** Calculates every active employee in memory, then writes payslips and lines in bulk. */
async function writeDraftPayslips(tx: Prisma.TransactionClient, runId: number) {
  const employees = await tx.employee.findMany({
    where: { status: 'ACTIVE' },
    include: {
      country: true,
      structure: { include: { components: { orderBy: { sortOrder: 'asc' } } } },
      payrollInputs: { where: { runId } },
    },
    orderBy: { id: 'asc' },
  });

  const drafts = employees.map((employee) =>
    draftPayslip({
      ...employee,
      structure: { name: employee.structure.name, rules: toStructureRules(employee.structure) },
      input: employee.payrollInputs[0] ?? null,
    }),
  );

  await tx.payslip.deleteMany({ where: { runId } }); // lines are removed by cascade
  await bulkInsert(
    tx,
    'Payslip',
    drafts.map((draft) => ({ runId, ...draft.payslip })),
  );
  const created = await tx.payslip.findMany({
    where: { runId },
    select: { id: true, employeeId: true },
  });
  const payslipIdByEmployee = new Map(created.map((p) => [p.employeeId, p.id]));
  await bulkInsert(
    tx,
    'PayslipLine',
    drafts.flatMap((draft) =>
      draft.lines.map((line) => ({
        payslipId: payslipIdByEmployee.get(draft.payslip.employeeId)!,
        ...line,
      })),
    ),
  );
}

/** FR-PAY-03: the run's payslips, optionally only flagged ones or one country. */
export async function listRunPayslips(runId: number, query: ListRunPayslipsQuery) {
  await findRunOrThrow(runId);
  const where: Prisma.PayslipWhereInput = {
    runId,
    ...(query.flagged !== undefined && { flagged: query.flagged }),
    ...(query.country && { countryCode: query.country }),
  };
  const [total, payslips] = await prisma.$transaction([
    prisma.payslip.count({ where }),
    prisma.payslip.findMany({
      where,
      orderBy: { employeeId: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return {
    items: payslips.map(toPayslipSummary),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

/** FR-PAY-03: one employee's full breakdown within a run. */
export async function getRunPayslip(runId: number, payslipId: number) {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, runId },
    include: { lines: true, run: true },
  });
  if (!payslip) throw AppError.notFound('Payslip not found in this payroll run');
  return toPayslipDetail(payslip);
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
