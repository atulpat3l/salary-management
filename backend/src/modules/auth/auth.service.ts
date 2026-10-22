import { env } from '../../config/env';
import type { Role } from '../../domain/constants';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type { ChangePasswordInput, LoginInput } from './auth.schema';
import { getDummyHash, hashPassword, verifyPassword } from './password';
import { signToken } from './token';

/** Who is making the request. Attached to `req.auth` by the authenticate middleware. */
export interface AuthContext {
  sessionId: string;
  accountId: number;
  role: Role;
  employeeId: number | null;
  mustChangePassword: boolean;
}

/** Only refresh lastActivityAt once a minute, so most requests do not write to the database. */
const ACTIVITY_WRITE_INTERVAL_MS = 60_000;

const accountWithEmployee = {
  employee: { select: { id: true, employeeCode: true, fullName: true, status: true } },
} as const;

const invalidCredentials = () =>
  AppError.unauthorized('Invalid ID or password', 'INVALID_CREDENTIALS');

const sessionExpired = () =>
  AppError.unauthorized('Your session has expired. Please log in again.', 'SESSION_EXPIRED');

/** FR-AUTH-01: verifies credentials and starts a new session. */
export async function login(input: LoginInput) {
  const account = await prisma.account.findUnique({
    where: { loginId: input.loginId },
    include: accountWithEmployee,
  });

  // Always run bcrypt, even for unknown IDs, so timing does not reveal which IDs exist.
  const passwordMatches = await verifyPassword(
    input.password,
    account?.passwordHash ?? getDummyHash(),
  );
  // Same message for an unknown ID and a wrong password.
  if (!account || !passwordMatches) throw invalidCredentials();

  if (account.employee?.status === 'INACTIVE') {
    throw AppError.forbidden('This account has been deactivated');
  }

  const session = await prisma.session.create({ data: { accountId: account.id } });
  return { token: signToken(session.id), user: toUserView(account) };
}

/**
 * Checks a session on every authenticated request. Expires it after inactivity (FR-AUTH-03)
 * and ends it if the employee has been deactivated since logging in (FR-EMP-04).
 */
export async function resolveSession(sessionId: string, now = new Date()): Promise<AuthContext> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { account: { include: accountWithEmployee } },
  });
  if (!session) throw sessionExpired();

  const idleMs = now.getTime() - session.lastActivityAt.getTime();
  const isIdle = idleMs > env.SESSION_IDLE_MINUTES * 60_000;
  const isDeactivated = session.account.employee?.status === 'INACTIVE';
  if (isIdle || isDeactivated) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
    throw sessionExpired();
  }

  if (idleMs > ACTIVITY_WRITE_INTERVAL_MS) {
    await prisma.session.update({ where: { id: sessionId }, data: { lastActivityAt: now } });
  }

  const { account } = session;
  return {
    sessionId,
    accountId: account.id,
    role: account.role as Role,
    employeeId: account.employeeId,
    mustChangePassword: account.mustChangePassword,
  };
}

/**
 * FR-AUTH-04/05: replaces the password after checking the current one, clears the forced-change
 * flag and ends every other session (e.g. one opened by whoever knew the temporary password).
 */
export async function changePassword(auth: AuthContext, input: ChangePasswordInput) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: auth.accountId } });
  if (!(await verifyPassword(input.currentPassword, account.passwordHash))) {
    throw AppError.validation('Current password is incorrect', {
      currentPassword: 'Current password is incorrect',
    });
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.account.update({
      where: { id: auth.accountId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.session.deleteMany({
      where: { accountId: auth.accountId, id: { not: auth.sessionId } },
    }),
  ]);
}

/** FR-AUTH-03: ends the session; the token stops working immediately. */
export async function logout(sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function getCurrentUser(accountId: number) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    include: accountWithEmployee,
  });
  return toUserView(account);
}

type AccountWithEmployee = {
  loginId: string;
  role: string;
  mustChangePassword: boolean;
  employee: { id: number; employeeCode: string; fullName: string } | null;
};

/** What the client may see about the logged-in user. Never includes the password hash. */
function toUserView(account: AccountWithEmployee) {
  return {
    loginId: account.loginId,
    role: account.role as Role,
    mustChangePassword: account.mustChangePassword,
    employee: account.employee && {
      id: account.employee.id,
      employeeCode: account.employee.employeeCode,
      fullName: account.employee.fullName,
    },
  };
}
