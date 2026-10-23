import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCountryInsights, useInsightsOverview, useJobTitleInsights } from '@/api/insights'
import { formatMoney } from '@/lib/format'
import type { Money } from '@/lib/types'

/**
 * FR-INS-01..03: salary statistics on active employees' annual base salary. Always per
 * country, in that country's currency; nothing here combines currencies.
 */
export function InsightsPage() {
  const overview = useInsightsOverview()
  const [country, setCountry] = useState<string>()

  return (
    <>
      <PageHeader
        title="Salary insights"
        description="Annual base salary of active employees, per country and in that country's currency."
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              {overview.data
                ? `${overview.data.headcount.toLocaleString()} active employees. There is no organisation-wide salary figure, because it would mix currencies.`
                : 'Countries side by side.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.isPending ? (
              <LoadingState rows={6} />
            ) : overview.isError ? (
              <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Headcount</TableHead>
                    <TableHead className="text-right">Minimum</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                    <TableHead className="text-right">Maximum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.data.countries.map((row) => (
                    <TableRow
                      key={row.country.code}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => setCountry(row.country.code)}
                      onKeyDown={(e) => e.key === 'Enter' && setCountry(row.country.code)}
                      data-state={row.country.code === country ? 'selected' : undefined}
                    >
                      <TableCell className="font-medium">{row.country.name}</TableCell>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.headcount.toLocaleString()}</TableCell>
                      <MoneyCell value={row.minimum} />
                      <MoneyCell value={row.average} />
                      <MoneyCell value={row.maximum} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="insights-country">Country details</Label>
          <Select value={country ?? ''} onValueChange={setCountry}>
            <SelectTrigger id="insights-country" className="w-64">
              <SelectValue placeholder="Choose a country" />
            </SelectTrigger>
            <SelectContent>
              {overview.data?.countries.map((row) => (
                <SelectItem key={row.country.code} value={row.country.code}>
                  {row.country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {country ? (
          <CountryDetails key={country} code={country} />
        ) : (
          <EmptyState title="Choose a country" description="See its salary statistics and average salary by job title." />
        )}
      </div>
    </>
  )
}

function MoneyCell({ value }: { value: Money | null }) {
  return <TableCell className="text-right tabular-nums">{formatMoney(value)}</TableCell>
}

function CountryDetails({ code }: { code: string }) {
  const stats = useCountryInsights(code)
  const jobTitles = useJobTitleInsights(code)
  const [titleFilter, setTitleFilter] = useState('')

  if (stats.isPending) return <LoadingState rows={6} />
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
  // FR-INS-01: a clear message instead of zeros.
  if (stats.data.message) return <EmptyState title={stats.data.message} />

  const filter = titleFilter.trim().toLowerCase()
  const rows = jobTitles.data?.jobTitles.filter((row) => row.jobTitle.toLowerCase().includes(filter)) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Headcount" value={stats.data.headcount.toLocaleString()} />
        <StatCard label="Minimum salary" value={formatMoney(stats.data.minimum)} />
        <StatCard label="Average salary" value={formatMoney(stats.data.average)} />
        <StatCard label="Maximum salary" value={formatMoney(stats.data.maximum)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By job title in {stats.data.country.name}</CardTitle>
          <CardDescription>Average annual base salary in {stats.data.currency}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-title-filter">Job title</Label>
            <Input
              id="job-title-filter"
              className="max-w-xs"
              placeholder="Filter job titles"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
            />
          </div>
          {jobTitles.isPending ? (
            <LoadingState rows={6} />
          ) : jobTitles.isError ? (
            <ErrorState error={jobTitles.error} onRetry={() => jobTitles.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="No matching job titles" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job title</TableHead>
                  <TableHead className="text-right">Headcount</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Maximum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.jobTitle}>
                    <TableCell className="font-medium">{row.jobTitle}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.headcount.toLocaleString()}</TableCell>
                    <MoneyCell value={row.minimum} />
                    <MoneyCell value={row.average} />
                    <MoneyCell value={row.maximum} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
