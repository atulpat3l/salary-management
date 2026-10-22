import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';
import { toMoney } from '../../lib/money';
import { prisma } from '../../lib/prisma';
import { getEmployee } from '../employees/employees.service';
import { paymentStatusOf, toPayslipDetail } from '../payslips/payslip.view';

/**
 * Employee self-service. Every function takes the employee id from the session, never from
 * the request, so an employee can only ever see their own data (FR-AUTH-02, NFR-07).
 */

/** Payslips are visible once the run is finalised; drafts never are (FR-ESS-01). */
const issuedPayslips = (employeeId: number): Prisma.PayslipWhereInput => ({
  employeeId,
  run: { status: { not: 'DRAFT' } },
});

/** FR-ESS-04: read-only profile with the standard monthly salary. */
export async function getMyProfile(employeeId: number) {
  const employee = await getEmployee(employeeId);
  return {
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    jobTitle: employee.jobTitle,
    country: employee.country,
    currency: employee.currency,
    annualBaseSalary: employee.annualBaseSalary,
    structure: { name: employee.structure.name, style: employee.structure.style },
    standardMonthlySalary: employee.standardMonthlySalary,
  };
}

/** FR-ESS-01: issued payslips, newest month first. */
export async function listMyPayslips(employeeId: number) {
  const payslips = await prisma.payslip.findMany({
    where: issuedPayslips(employeeId),
    include: { run: true },
    orderBy: { run: { month: 'desc' } },
  });
  return payslips.map((payslip) => ({
    id: payslip.id,
    month: payslip.run.month,
    currency: payslip.currency,
    gross: toMoney(payslip.gross, payslip.currency),
    totalDeductions: toMoney(payslip.totalDeductions, payslip.currency),
    net: toMoney(payslip.net, payslip.currency),
    paymentStatus: paymentStatusOf(payslip.run),
    paymentDate: payslip.run.paymentDate?.toISOString().slice(0, 10) ?? null,
  }));
}

/**
 * FR-ESS-02: one payslip exactly as issued. Someone else's payslip, a draft, or a missing id
 * all give the same 404, so ids cannot be probed.
 */
export async function getMyPayslip(employeeId: number, payslipId: number) {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, ...issuedPayslips(employeeId) },
    include: { lines: true, run: true },
  });
  if (!payslip) throw AppError.notFound('Payslip not found');
  return toPayslipDetail(payslip);
}

/** FR-ESS-03: what was paid and when; finalised months not yet paid show as PENDING. */
export async function listMyDisbursements(employeeId: number) {
  const payslips = await listMyPayslips(employeeId);
  return payslips.map(({ id, month, net, paymentStatus, paymentDate }) => ({
    payslipId: id,
    month,
    netPaid: net,
    status: paymentStatus,
    paymentDate,
  }));
}
