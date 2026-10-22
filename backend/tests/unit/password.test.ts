import { getDummyHash, hashPassword, verifyPassword } from '../../src/modules/auth/password';

describe('NFR-06: password hashing', () => {
  it('never stores the password in readable form', async () => {
    const hash = await hashPassword('Passw0rd1');
    expect(hash).not.toContain('Passw0rd1');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt format
  });

  it('verifies the correct password and rejects others', async () => {
    const hash = await hashPassword('Passw0rd1');
    await expect(verifyPassword('Passw0rd1', hash)).resolves.toBe(true);
    await expect(verifyPassword('passw0rd1', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('salts every hash, so equal passwords give different hashes', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('provides a stable dummy hash that matches no real password', async () => {
    const dummy = getDummyHash();
    expect(getDummyHash()).toBe(dummy);
    await expect(verifyPassword('Passw0rd1', dummy)).resolves.toBe(false);
  });
});
