import { prisma } from '../../src/lib/prisma';

/** Deletes every row, children before parents, so each test file starts from an empty database. */
export async function resetDb() {
  await prisma.$transaction([
    prisma.payslipLine.deleteMany(),
    prisma.payslip.deleteMany(),
    prisma.payrollInput.deleteMany(),
    prisma.payrollRun.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.structureComponent.deleteMany(),
    prisma.salaryStructure.deleteMany(),
    prisma.country.deleteMany(),
  ]);
}

export { prisma };
