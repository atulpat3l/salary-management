import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { toSalaryStats, type SalaryAggregate } from './insights.stats';

/**
 * Salary insights (FR-INS-01..03). Always per country, in that country's currency, using
 * active employees' annual base salary. Nothing here ever combines two currencies (NFR-04).
 *
 * Salaries are aggregated by SQLite as whole cents (integers), so min, max and sums are exact;
 * ROUND() removes the tiny binary error of SQLite's numeric storage first. Figures are read
 * live from the employee table, so they always match current records.
 */
const salaryAggregates = (salary: Prisma.Sql, counted: Prisma.Sql) => Prisma.sql`
  COUNT(${counted}) AS "headcount",
  MIN(CAST(ROUND(${salary} * 100) AS INTEGER)) AS "minCents",
  MAX(CAST(ROUND(${salary} * 100) AS INTEGER)) AS "maxCents",
  SUM(CAST(ROUND(${salary} * 100) AS INTEGER)) AS "sumCents"`;

const ofEmployees = salaryAggregates(Prisma.raw('"annualBaseSalary"'), Prisma.raw('*'));

async function findCountryOrThrow(code: string) {
  const country = await prisma.country.findUnique({ where: { code } });
  if (!country) throw AppError.notFound('Country not supported');
  return country;
}

const noEmployeesMessage = (countryName: string) =>
  `There are no active employees in ${countryName}`;

/** FR-INS-01: min, max and average annual base salary and headcount for one country. */
export async function getCountryInsights(code: string) {
  const country = await findCountryOrThrow(code);
  const [aggregate] = await prisma.$queryRaw<SalaryAggregate[]>`
    SELECT ${ofEmployees}
    FROM "Employee"
    WHERE "status" = 'ACTIVE' AND "countryCode" = ${code}`;
  const stats = toSalaryStats(aggregate, country.currencyCode);

  return {
    country: { code: country.code, name: country.name },
    currency: country.currencyCode,
    ...stats,
    message: stats.headcount === 0 ? noEmployeesMessage(country.name) : null,
  };
}

/** FR-INS-02: each job title in a country with its headcount and average salary. */
export async function getJobTitleInsights(code: string, jobTitle?: string) {
  const country = await findCountryOrThrow(code);
  const rows = await prisma.$queryRaw<(SalaryAggregate & { jobTitle: string })[]>`
    SELECT "jobTitle", ${ofEmployees}
    FROM "Employee"
    WHERE "status" = 'ACTIVE' AND "countryCode" = ${code}
      ${jobTitle === undefined ? Prisma.empty : Prisma.sql`AND "jobTitle" = ${jobTitle}`}
    GROUP BY "jobTitle"
    ORDER BY "jobTitle"`;

  return {
    country: { code: country.code, name: country.name },
    currency: country.currencyCode,
    jobTitles: rows.map(({ jobTitle: title, ...aggregate }) => ({
      jobTitle: title,
      ...toSalaryStats(aggregate, country.currencyCode),
    })),
    message: rows.length === 0 ? noEmployeesMessage(country.name) : null,
  };
}

/**
 * FR-INS-03: total headcount and one row per supported country with its own statistics.
 * There is deliberately no organisation-wide salary figure: it would mix currencies.
 */
export async function getOverview() {
  const rows = await prisma.$queryRaw<
    (SalaryAggregate & { code: string; name: string; currencyCode: string })[]
  >`
    SELECT c."code", c."name", c."currencyCode",
           ${salaryAggregates(Prisma.raw('e."annualBaseSalary"'), Prisma.raw('e."id"'))}
    FROM "Country" c
    LEFT JOIN "Employee" e ON e."countryCode" = c."code" AND e."status" = 'ACTIVE'
    GROUP BY c."code", c."name", c."currencyCode"
    ORDER BY c."name"`;

  const countries = rows.map(({ code, name, currencyCode, ...aggregate }) => ({
    country: { code, name },
    currency: currencyCode,
    ...toSalaryStats(aggregate, currencyCode),
  }));

  return {
    headcount: countries.reduce((sum, row) => sum + row.headcount, 0),
    countries,
  };
}
