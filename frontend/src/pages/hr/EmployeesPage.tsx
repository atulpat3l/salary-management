import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
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
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCountries, useEmployees, useJobTitles, type EmployeeListParams } from '@/api/employees'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatMoney } from '@/lib/format'

type SortField = NonNullable<EmployeeListParams['sort']>

/** The characters the API accepts in a search (names and Employee IDs). */
const SEARCH_PATTERN = /^[\p{L}\p{M}\p{N} .'-]*$/u
const ALL = 'all'

/**
 * FR-FIND-01..04: the HR home view. Search, filters, sort and page live in the URL, so they
 * survive opening an employee and coming back.
 */
export function EmployeesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const country = params.get('country') ?? ''
  const jobTitle = params.get('jobTitle') ?? ''
  const status = params.get('status') ?? ''
  const sort = (params.get('sort') ?? 'employeeCode') as SortField
  const order = params.get('order') === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, Number(params.get('page')) || 1)

  /** Applies changes to the URL. Any change other than the page itself goes back to page 1. */
  const update = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )

  const searchIsValid = SEARCH_PATTERN.test(q)
  const debouncedQ = useDebouncedValue(q.trim())

  const countries = useCountries()
  const jobTitles = useJobTitles(country || undefined)
  const employees = useEmployees({
    q: searchIsValid ? debouncedQ || undefined : undefined,
    country: country || undefined,
    jobTitle: jobTitle || undefined,
    status: status || undefined,
    sort,
    order,
    page,
    pageSize: 25,
  })

  const onCountryChange = (value: string) =>
    update({
      country: value === ALL ? null : value,
      jobTitle: null, // titles differ per country
      // FR-FIND-04: salary sort needs a single currency.
      ...(value === ALL && sort === 'salary' && { sort: null }),
    })

  return (
    <>
      <PageHeader
        title="Employees"
        description="Search, filter and manage employee records."
        actions={
          <Button asChild>
            <Link to="/employees/new">
              <PlusIcon />
              Add employee
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1.4fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee-search">Search</Label>
              <div className="relative">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="employee-search"
                  className="pl-8"
                  placeholder="Name or Employee ID"
                  value={q}
                  onChange={(e) => update({ q: e.target.value })}
                  aria-invalid={!searchIsValid}
                />
              </div>
              {!searchIsValid && (
                <FieldError>Use only letters, numbers, spaces, apostrophes, hyphens and dots.</FieldError>
              )}
            </div>

            <FilterSelect
              id="filter-country"
              label="Country"
              value={country}
              onChange={onCountryChange}
              allLabel="All countries"
              options={(countries.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
            />
            <FilterSelect
              id="filter-job-title"
              label="Job title"
              value={jobTitle}
              onChange={(value) => update({ jobTitle: value === ALL ? null : value })}
              allLabel="All job titles"
              options={(jobTitles.data ?? []).map((title) => ({ value: title, label: title }))}
            />
            <FilterSelect
              id="filter-status"
              label="Status"
              value={status}
              onChange={(value) => update({ status: value === ALL ? null : value })}
              allLabel="All statuses"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sort">Sort by</Label>
              <div className="flex gap-1">
                <Select value={sort} onValueChange={(value) => update({ sort: value })}>
                  <SelectTrigger id="sort" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employeeCode">Employee ID</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="salary" disabled={!country}>
                      {country ? 'Salary' : 'Salary (choose one country)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => update({ order: order === 'asc' ? 'desc' : null })}
                  aria-label={order === 'asc' ? 'Ascending; switch to descending' : 'Descending; switch to ascending'}
                >
                  {order === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />}
                </Button>
              </div>
            </div>
          </div>
          {!country && (
            <p className="text-xs text-muted-foreground">
              Sorting by salary is available once a single country is selected, because amounts in
              different currencies cannot be compared.
            </p>
          )}

          {employees.isPending ? (
            <LoadingState rows={8} />
          ) : employees.isError ? (
            <ErrorState error={employees.error} onRetry={() => employees.refetch()} />
          ) : employees.data.items.length === 0 ? (
            <EmptyState title="No employees found" description="Try a different search or clear the filters." />
          ) : (
            <div className={employees.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Job title</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Annual base salary</TableHead>
                    <TableHead className="text-right">Monthly gross</TableHead>
                    <TableHead className="text-right">Monthly net</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.data.items.map((employee) => (
                    <TableRow
                      key={employee.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/employees/${employee.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{employee.employeeCode}</TableCell>
                      <TableCell>
                        <Link
                          to={`/employees/${employee.id}`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {employee.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{employee.jobTitle}</TableCell>
                      <TableCell>{employee.country.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(employee.annualBaseSalary)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(employee.standardMonthlyGross)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(employee.standardMonthlyNet)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={employee.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={employees.data.page}
                totalPages={employees.data.totalPages}
                total={employees.data.total}
                noun="employees"
                onPageChange={(next) => update({ page: String(next) })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface FilterSelectProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: { value: string; label: string }[]
}

function FilterSelect({ id, label, value, onChange, allLabel, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ALL} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
