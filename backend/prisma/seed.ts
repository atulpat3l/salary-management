/**
 * Seed data (FR-DATA-01). Deterministic and repeatable: running it again resets the demo data
 * to the same known state. All data is fictional.
 */
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/modules/auth/password';
import { DEMO_EMPLOYEE_PASSWORD, DEMO_EMPLOYEES, seedDemoData } from './seed/seedDemoData';
import { seedReferenceData } from './seed/seedReferenceData';

/** Documented demo credentials (README). */
export const DEMO_HR = { loginId: 'HR001', password: 'HrAdmin123' };

async function seedHrAccount() {
  const passwordHash = await hashPassword(DEMO_HR.password);
  await prisma.account.upsert({
    where: { loginId: DEMO_HR.loginId },
    update: { passwordHash, role: 'HR', mustChangePassword: false },
    create: { loginId: DEMO_HR.loginId, passwordHash, role: 'HR', mustChangePassword: false },
  });
}

async function main() {
  const started = Date.now();

  const reference = await seedReferenceData();
  console.log(`Countries: ${reference.countries} · Salary structures: ${reference.structures}`);

  const demo = await seedDemoData();
  console.log(`Employees: ${demo.employees} (${demo.active} active)`);
  console.log(`Payroll finalised and paid for: ${demo.payrollMonths.join(', ')}`);

  await seedHrAccount();
  console.log('\nDemo logins');
  console.log(`  HR        ${DEMO_HR.loginId} / ${DEMO_HR.password}`);
  DEMO_EMPLOYEES.forEach((employee, index) => {
    const code = `EMP${String(index + 1).padStart(5, '0')}`;
    console.log(
      `  Employee  ${code} / ${DEMO_EMPLOYEE_PASSWORD}  (${employee.fullName}, ${employee.countryCode})`,
    );
  });
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
