import { prisma } from '../../src/lib/prisma';
import { COUNTRIES, STRUCTURES } from './referenceData';

/**
 * Creates or updates the supported countries and salary structures. Safe to run repeatedly:
 * structures keep their ids (employees reference them) and their components are replaced.
 */
export async function seedReferenceData() {
  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: country,
      create: country,
    });
  }

  for (const { components, ...structure } of STRUCTURES) {
    await prisma.$transaction(async (tx) => {
      const saved = await tx.salaryStructure.upsert({
        where: { name: structure.name },
        update: structure,
        create: structure,
      });
      await tx.structureComponent.deleteMany({ where: { structureId: saved.id } });
      await tx.structureComponent.createMany({
        data: components.map((component, index) => ({
          ...component,
          structureId: saved.id,
          sortOrder: index + 1,
        })),
      });
    });
  }

  return { countries: COUNTRIES.length, structures: STRUCTURES.length };
}
