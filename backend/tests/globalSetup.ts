import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { TEST_DATABASE_URL } from './testDatabase';

/** Runs once before the whole test run: recreates the test database from the migrations. */
export default function globalSetup() {
  const backendDir = path.resolve(__dirname, '..');
  rmSync(path.join(backendDir, 'test.db'), { force: true });
  execSync('npx prisma migrate deploy', {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
