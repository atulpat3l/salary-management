import { createRunSchema, saveInputsSchema } from '../../src/modules/payroll/payroll.schema';

const fieldErrors = (input: unknown) => {
  const result = saveInputsSchema.safeParse(input);
  if (result.success) return {};
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[issue.path.join('.')] ??= issue.message;
  return fields;
};

describe('payroll run month', () => {
  it.each(['2026-01', '2026-12', ' 2026-10 '])('accepts %j', (month) => {
    expect(createRunSchema.safeParse({ month }).success).toBe(true);
  });

  it.each(['2026-13', '2026-00', '2026-1', '26-10', '2026/10', 'October', ''])(
    'rejects %j',
    (month) => {
      const result = createRunSchema.safeParse({ month });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Month must be in YYYY-MM format, e.g. 2026-10',
        );
      }
    },
  );
});

describe('FR-PAY-01: monthly inputs', () => {
  it('accepts full inputs and keeps the numbers as exact strings', () => {
    expect(
      saveInputsSchema.parse({
        inputs: [{ employeeId: 7, overtimeHours: 10.5, bonus: '1000.50', achievementPct: 80 }],
      }),
    ).toEqual({
      inputs: [{ employeeId: 7, overtimeHours: '10.5', bonus: '1000.50', achievementPct: '80' }],
    });
  });

  it('leaves out fields that were not entered, so their defaults apply', () => {
    expect(saveInputsSchema.parse({ inputs: [{ employeeId: 7 }] })).toEqual({
      inputs: [{ employeeId: 7 }],
    });
  });

  it.each([
    ['overtimeHours', '0'],
    ['overtimeHours', '100'],
    ['bonus', '0'],
    ['achievementPct', '0'],
    ['achievementPct', '200'],
  ])('accepts the boundary %s = %s', (field, value) => {
    expect(fieldErrors({ inputs: [{ employeeId: 1, [field]: value }] })).toEqual({});
  });

  it.each([
    ['overtimeHours', '-1', 'Overtime hours cannot be negative'],
    ['overtimeHours', '100.01', 'Overtime hours must be at most 100'],
    ['bonus', '-0.01', 'Bonus cannot be negative'],
    ['bonus', '10.999', 'Bonus can have at most two decimal places'],
    ['achievementPct', '200.5', 'Achievement % must be at most 200'],
    ['achievementPct', '-5', 'Achievement % cannot be negative'],
    ['achievementPct', 'lots', 'Achievement % must be a number'],
  ])('rejects %s = %s: %s', (field, value, message) => {
    expect(fieldErrors({ inputs: [{ employeeId: 1, [field]: value }] })).toEqual({
      [`inputs.0.${field}`]: message,
    });
  });

  it('points each error at the exact row and field', () => {
    expect(
      fieldErrors({
        inputs: [{ employeeId: 1 }, { employeeId: 2, bonus: '-5' }, { employeeId: 'x' }],
      }),
    ).toEqual({
      'inputs.1.bonus': 'Bonus cannot be negative',
      'inputs.2.employeeId': 'Employee is required',
    });
  });

  it('rejects the same employee twice in one request', () => {
    expect(fieldErrors({ inputs: [{ employeeId: 1 }, { employeeId: 1 }] })).toEqual({
      'inputs.1.employeeId': 'This employee appears more than once',
    });
  });

  it('rejects an empty or missing list', () => {
    expect(fieldErrors({ inputs: [] })).toEqual({
      inputs: 'Provide inputs for at least one employee',
    });
    expect(fieldErrors({})).toEqual({ inputs: 'Inputs must be a list' });
  });
});
