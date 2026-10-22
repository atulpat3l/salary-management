import { COUNTRIES, STRUCTURES } from '../../prisma/seed/referenceData';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { prisma, resetDb } from '../helpers/db';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('FR-DATA-01: seeding countries and salary structures', () => {
  it('creates every country, structure and component', async () => {
    const counts = await seedReferenceData();

    expect(counts).toEqual({ countries: COUNTRIES.length, structures: STRUCTURES.length });
    expect(await prisma.country.count()).toBe(COUNTRIES.length);
    expect(await prisma.salaryStructure.count()).toBe(STRUCTURES.length);
    expect(await prisma.structureComponent.count()).toBe(
      STRUCTURES.reduce((sum, s) => sum + s.components.length, 0),
    );
  });

  it('stores components in their defined order', async () => {
    await seedReferenceData();
    const structure = await prisma.salaryStructure.findUniqueOrThrow({
      where: { name: 'US Standard' },
      include: { components: { orderBy: { sortOrder: 'asc' } } },
    });
    expect(structure.components.map((c) => [c.sortOrder, c.name])).toEqual([
      [1, 'Housing allowance'],
      [2, 'Transport allowance'],
      [3, 'Income tax'],
      [4, 'Retirement'],
      [5, 'Health insurance'],
    ]);
  });

  it('is repeatable: running it again changes no counts and keeps structure ids stable', async () => {
    await seedReferenceData();
    const idsBefore = await prisma.salaryStructure.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });

    await seedReferenceData();

    expect(
      await prisma.salaryStructure.findMany({
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(idsBefore);
    expect(await prisma.country.count()).toBe(COUNTRIES.length);
    expect(await prisma.structureComponent.count()).toBe(
      STRUCTURES.reduce((sum, s) => sum + s.components.length, 0),
    );
  });

  it('keeps existing employees linked to their structure when re-run', async () => {
    await seedReferenceData();
    const structure = await prisma.salaryStructure.findUniqueOrThrow({
      where: { name: 'IN Sales' },
    });
    const employee = await prisma.employee.create({
      data: {
        employeeCode: 'EMP00001',
        fullName: 'Asha Rao',
        jobTitle: 'Account Executive',
        countryCode: 'IN',
        annualBaseSalary: '1200000',
        structureId: structure.id,
      },
    });

    await seedReferenceData();

    const reloaded = await prisma.employee.findUniqueOrThrow({
      where: { id: employee.id },
      include: { structure: true },
    });
    expect(reloaded.structure.name).toBe('IN Sales');
  });
});
