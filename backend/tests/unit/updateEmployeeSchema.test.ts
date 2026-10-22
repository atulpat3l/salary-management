import { updateEmployeeSchema } from '../../src/modules/employees/employees.schema';

describe('FR-EMP-03: employee edit input', () => {
  it('accepts any single field', () => {
    expect(updateEmployeeSchema.parse({ jobTitle: ' Lead Engineer ' })).toEqual({
      jobTitle: 'Lead Engineer',
    });
    expect(updateEmployeeSchema.parse({ annualBaseSalary: 65000 })).toEqual({
      annualBaseSalary: '65000',
    });
  });

  it('applies the same rules as creation to the fields that are sent', () => {
    const result = updateEmployeeSchema.safeParse({ fullName: '  ', annualBaseSalary: '0' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0]).sort()).toEqual([
        'annualBaseSalary',
        'fullName',
      ]);
    }
  });

  it('rejects an empty change', () => {
    const result = updateEmployeeSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Provide at least one field to change');
    }
  });

  it('ignores fields that cannot be edited (Employee ID, status, currency)', () => {
    const result = updateEmployeeSchema.safeParse({
      employeeCode: 'EMP99999',
      status: 'INACTIVE',
      currency: 'EUR',
    });
    expect(result.success).toBe(false); // nothing editable was sent
    expect(updateEmployeeSchema.parse({ jobTitle: 'X', status: 'INACTIVE' })).toEqual({
      jobTitle: 'X',
    });
  });
});
