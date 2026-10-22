import { createEmployeeSchema } from '../../src/modules/employees/employees.schema';

const valid = {
  fullName: 'Asha Rao',
  jobTitle: 'Software Engineer',
  countryCode: 'IN',
  annualBaseSalary: '1200000.50',
  structureId: 3,
};

/** Field → first error message, like the API returns. */
function errorsFor(input: Record<string, unknown>) {
  const result = createEmployeeSchema.safeParse(input);
  if (result.success) return {};
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[String(issue.path[0])] ??= issue.message;
  return fields;
}

describe('FR-EMP-05: employee field rules', () => {
  it('accepts a complete, valid employee', () => {
    expect(createEmployeeSchema.parse(valid)).toEqual(valid);
  });

  it('ignores leading and trailing spaces and normalises the country code', () => {
    const parsed = createEmployeeSchema.parse({
      ...valid,
      fullName: '  Asha  Rao ',
      jobTitle: ' Engineer ',
      countryCode: ' in ',
    });
    expect(parsed).toMatchObject({
      fullName: 'Asha  Rao',
      jobTitle: 'Engineer',
      countryCode: 'IN',
    });
  });

  it('reports every missing field at once, with friendly messages', () => {
    expect(errorsFor({})).toEqual({
      fullName: 'Full name is required',
      jobTitle: 'Job title is required',
      countryCode: 'Country is required',
      annualBaseSalary: 'Annual base salary is required',
      structureId: 'Salary structure is required',
    });
  });

  it.each([['fullName'], ['jobTitle']])('rejects a blank %s', (field) => {
    expect(Object.keys(errorsFor({ ...valid, [field]: '   ' }))).toEqual([field]);
  });

  it('limits the name to a reasonable length', () => {
    expect(errorsFor({ ...valid, fullName: 'x'.repeat(100) })).toEqual({});
    expect(errorsFor({ ...valid, fullName: 'x'.repeat(101) })).toEqual({
      fullName: 'Full name must be at most 100 characters',
    });
  });

  it('rejects a malformed country code', () => {
    expect(errorsFor({ ...valid, countryCode: 'India' })).toEqual({
      countryCode: 'Must be a two-letter country code',
    });
  });

  describe('annual base salary', () => {
    it.each([
      ['60000', '60000'],
      [60000, '60000'],
      [60000.5, '60000.5'],
      [' 75000.25 ', '75000.25'],
      ['0.01', '0.01'],
    ])('accepts %j and keeps it as the exact string %j', (input, expected) => {
      expect(
        createEmployeeSchema.parse({ ...valid, annualBaseSalary: input }).annualBaseSalary,
      ).toBe(expected);
    });

    it.each([
      ['0', 'Annual base salary must be greater than zero'],
      [0, 'Annual base salary must be greater than zero'],
      ['-100', 'Annual base salary must be greater than zero'],
      ['100.123', 'Annual base salary can have at most two decimal places'],
      ['abc', 'Annual base salary must be a number'],
      ['1,000', 'Annual base salary must be a number'],
      ['', 'Annual base salary is required'],
      [null, 'Annual base salary is required'],
      ['1234567890123', 'Annual base salary is too large'],
    ])('rejects %j: %s', (input, message) => {
      expect(errorsFor({ ...valid, annualBaseSalary: input })).toEqual({
        annualBaseSalary: message,
      });
    });
  });

  it.each([[null], ['abc'], [0], [-1], [1.5]])('rejects the structure id %j', (structureId) => {
    expect(errorsFor({ ...valid, structureId })).toEqual({
      structureId: 'Salary structure is required',
    });
  });

  it('accepts a numeric string structure id (e.g. from a form select)', () => {
    expect(createEmployeeSchema.parse({ ...valid, structureId: '3' }).structureId).toBe(3);
  });
});
