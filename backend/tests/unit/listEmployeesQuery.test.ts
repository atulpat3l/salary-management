import { listEmployeesQuerySchema } from '../../src/modules/employees/employees.schema';

const parse = (query: Record<string, string>) => listEmployeesQuerySchema.safeParse(query);
const fieldErrors = (query: Record<string, string>) => {
  const result = parse(query);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe('FR-FIND-01..04: employee list query', () => {
  it('defaults to the first page of 25, sorted by Employee ID', () => {
    expect(listEmployeesQuerySchema.parse({})).toEqual({
      sort: 'employeeCode',
      order: 'asc',
      page: 1,
      pageSize: 25,
    });
  });

  it('reads numbers from the query string and normalises text', () => {
    expect(
      listEmployeesQuerySchema.parse({
        q: '  asha ',
        country: 'in',
        jobTitle: ' Engineer ',
        status: 'active',
        page: '3',
        pageSize: '50',
      }),
    ).toMatchObject({
      q: 'asha',
      country: 'IN',
      jobTitle: 'Engineer',
      status: 'ACTIVE',
      page: 3,
      pageSize: 50,
    });
  });

  it('treats an empty search as no search', () => {
    expect(listEmployeesQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ page: 'abc' }, 'page'],
    [{ pageSize: '101' }, 'pageSize'],
    [{ pageSize: '0' }, 'pageSize'],
    [{ status: 'retired' }, 'status'],
    [{ sort: 'jobTitle' }, 'sort'],
    [{ order: 'up' }, 'order'],
    [{ country: 'USA' }, 'country'],
  ])('rejects %j', (query, field) => {
    expect(Object.keys(fieldErrors(query))).toEqual([field]);
  });

  describe('FR-FIND-04: sorting by salary', () => {
    it('is allowed when the list is filtered to one country', () => {
      expect(parse({ sort: 'salary', country: 'US', order: 'desc' }).success).toBe(true);
    });

    it('is refused across countries, with an explanation', () => {
      expect(fieldErrors({ sort: 'salary' })).toEqual({
        sort: 'Sorting by salary needs a single country selected, because amounts in different currencies cannot be compared',
      });
    });
  });
});
