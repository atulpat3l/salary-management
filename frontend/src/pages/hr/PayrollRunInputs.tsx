import { useState, type FormEvent } from 'react'
import { PencilIcon, SearchIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useEmployees } from '@/api/employees'
import { useRunInputs, useSaveInputs } from '@/api/payroll'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { formatMoney } from '@/lib/format'

/** Limits agreed in the PRD (FR-PAY-01). */
const MAX_OVERTIME_HOURS = 100
const MAX_ACHIEVEMENT_PCT = 200
const DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,2})?$/

interface SelectedEmployee {
  id: number
  employeeCode: string
  fullName: string
  currency: string
}

interface InputValues {
  overtimeHours: string
  bonus: string
  achievementPct: string
}

type InputErrors = Partial<Record<keyof InputValues, string>>

const EMPTY: InputValues = { overtimeHours: '', bonus: '', achievementPct: '' }

function validate(values: InputValues): InputErrors {
  const errors: InputErrors = {}
  const check = (field: keyof InputValues, label: string, max?: number) => {
    const value = values[field].trim()
    if (!value) return // left blank → the default applies
    if (!DECIMAL_PATTERN.test(value)) errors[field] = `${label} must be zero or more, with at most two decimals`
    else if (max !== undefined && Number(value) > max) errors[field] = `${label} must be at most ${max}`
  }
  check('overtimeHours', 'Overtime hours', MAX_OVERTIME_HOURS)
  check('bonus', 'Bonus')
  check('achievementPct', 'Achievement %', MAX_ACHIEVEMENT_PCT)
  return errors
}

/**
 * FR-PAY-01: overtime, bonus and variable pay achievement for the month. Employees without
 * inputs are paid with the defaults (0 hours, no bonus, 100%).
 */
export function PayrollRunInputs({ runId, editable }: { runId: number; editable: boolean }) {
  const inputs = useRunInputs(runId)
  const save = useSaveInputs(runId)
  const [employee, setEmployee] = useState<SelectedEmployee | null>(null)
  const [values, setValues] = useState<InputValues>(EMPTY)
  const [errors, setErrors] = useState<InputErrors>({})

  const setField = (field: keyof InputValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const reset = () => {
    setEmployee(null)
    setValues(EMPTY)
    setErrors({})
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!employee) return
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    save.mutate(
      [
        {
          employeeId: employee.id,
          overtimeHours: values.overtimeHours.trim() || '0',
          bonus: values.bonus.trim() || '0',
          achievementPct: values.achievementPct.trim() || '100',
        },
      ],
      {
        onSuccess: () => {
          toast.success(`Inputs saved for ${employee.fullName}. Recalculate to update pay.`)
          reset()
        },
        onError: (error) => {
          // Server errors are keyed like "inputs.0.bonus".
          const fields = Object.fromEntries(
            Object.entries(getFieldErrors(error)).map(([key, message]) => [key.replace(/^inputs\.\d+\./, ''), message]),
          )
          setErrors(fields)
          if (Object.keys(fields).length === 0 || fields.employeeId) {
            toast.error(fields.employeeId ?? getErrorMessage(error))
          }
        },
      },
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {editable && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Enter inputs</CardTitle>
            <CardDescription>Leave a field blank to use its default.</CardDescription>
          </CardHeader>
          <CardContent>
            {employee ? (
              <form onSubmit={onSubmit} noValidate>
                <FieldGroup>
                  <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                    <div>
                      <div className="font-medium">{employee.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {employee.employeeCode} · {employee.currency}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={reset} aria-label="Choose another employee">
                      <XIcon />
                    </Button>
                  </div>
                  <NumberField
                    id="overtimeHours"
                    label="Overtime hours"
                    placeholder="0"
                    value={values.overtimeHours}
                    onChange={(v) => setField('overtimeHours', v)}
                    error={errors.overtimeHours}
                  />
                  <NumberField
                    id="bonus"
                    label={`Bonus (${employee.currency})`}
                    placeholder="0.00"
                    value={values.bonus}
                    onChange={(v) => setField('bonus', v)}
                    error={errors.bonus}
                  />
                  <NumberField
                    id="achievementPct"
                    label="Variable pay achievement %"
                    placeholder="100"
                    value={values.achievementPct}
                    onChange={(v) => setField('achievementPct', v)}
                    error={errors.achievementPct}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={save.isPending}>
                      {save.isPending ? 'Saving…' : 'Save inputs'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={reset}>
                      Cancel
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            ) : (
              <EmployeePicker onSelect={setEmployee} />
            )}
          </CardContent>
        </Card>
      )}

      <Card className={editable ? 'h-fit' : 'h-fit lg:col-span-2'}>
        <CardHeader>
          <CardTitle>Inputs entered</CardTitle>
          <CardDescription>Everyone else is paid with 0 overtime hours, no bonus and 100% achievement.</CardDescription>
        </CardHeader>
        <CardContent>
          {inputs.isPending ? (
            <LoadingState />
          ) : inputs.isError ? (
            <ErrorState error={inputs.error} onRetry={() => inputs.refetch()} />
          ) : inputs.data.length === 0 ? (
            <EmptyState title="No inputs entered" description="All employees will be paid their standard monthly salary." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Overtime hours</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Achievement</TableHead>
                  {editable && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {inputs.data.map((input) => (
                  <TableRow key={input.employeeId}>
                    <TableCell>
                      <div className="font-medium">{input.fullName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{input.employeeCode}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{input.overtimeHours}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(input.bonus)}</TableCell>
                    <TableCell className="text-right tabular-nums">{input.achievementPct}%</TableCell>
                    {editable && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit inputs for ${input.fullName}`}
                          onClick={() => {
                            setEmployee({
                              id: input.employeeId,
                              employeeCode: input.employeeCode,
                              fullName: input.fullName,
                              currency: input.bonus.currency,
                            })
                            setValues({
                              overtimeHours: input.overtimeHours,
                              bonus: input.bonus.amount,
                              achievementPct: input.achievementPct,
                            })
                            setErrors({})
                          }}
                        >
                          <PencilIcon />
                        </Button>
                      </TableCell>
                    )}
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

function NumberField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

/** Finds an active employee by name or Employee ID. Only active employees are paid. */
function EmployeePicker({ onSelect }: { onSelect: (employee: SelectedEmployee) => void }) {
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim())
  const results = useEmployees({ q, status: 'ACTIVE', pageSize: 8 }, { enabled: q.length > 0 })

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="input-employee-search">Employee</FieldLabel>
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="input-employee-search"
            className="pl-8"
            placeholder="Search by name or Employee ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Field>
      {q.length > 0 &&
        (results.isPending ? (
          <LoadingState rows={3} />
        ) : results.isError ? (
          <ErrorState error={results.error} />
        ) : results.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active employees found.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {results.data.items.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() =>
                    onSelect({ id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, currency: e.currency })
                  }
                >
                  <span>
                    <span className="font-medium">{e.fullName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {e.employeeCode} · {e.jobTitle}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{e.country.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
