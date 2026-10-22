/**
 * Seed data (FR-DATA-01). Safe to run repeatedly: every record is upserted.
 * So far it creates countries, salary structures and the HR login; employees and payroll
 * history are added in later steps.
 */
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/modules/auth/password';
import { seedReferenceData } from './seed/seedReferenceData';

/** Documented demo credentials (README). Fictional data only. */
export const DEMO_HR = { loginId: 'HR001', password: 'HrAdmin123' };

async function seedHrAccount() {
  const passwordHash = await hashPassword(DEMO_HR.password);
  await prisma.account.upsert({
    where: { loginId: DEMO_HR.loginId },
    update: { passwordHash, role: 'HR', mustChangePassword: false },
    create: { loginId: DEMO_HR.loginId, passwordHash, role: 'HR', mustChangePassword: false },
  });
  console.log(`HR account: ${DEMO_HR.loginId} / ${DEMO_HR.password}`);
}

async function main() {
  const counts = await seedReferenceData();
  console.log(
    `Reference data: ${counts.countries} countries, ${counts.structures} salary structures`,
  );
  await seedHrAccount();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
