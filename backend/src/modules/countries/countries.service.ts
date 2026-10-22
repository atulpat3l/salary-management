import { prisma } from '../../lib/prisma';

/** FR-CUR-01: the supported countries, each with its one currency and locale for formatting. */
export async function listCountries() {
  return prisma.country.findMany({
    select: { code: true, name: true, currencyCode: true, locale: true },
    orderBy: { name: 'asc' },
  });
}
