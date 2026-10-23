import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { PayBreakdownTable } from '@/components/PayBreakdownTable'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { TemporaryPasswordDialog } from '@/components/TemporaryPasswordDialog'
import {
  useCountries,
  useCreateEmployee,
  useEmployee,
  useJobTitles,
  useSalaryPreview,
  useUpdateEmployee,
} from '@/api/employees'
import { useStructures } from '@/api/structures'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage, getFieldErrors, getStatus } from '@/lib/api'
import type { EmployeeDetail } from '@/lib/types'

interface FormValues {
  fullName: string
  jobTitle: string
  countryCode: string
  annualBaseSalary: string
  structureId: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/

/** FR-EMP-05 field rules, checked before submitting. The server checks them again. */
function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}
  const fullName = values.fullName.trim()
  const jobTitle = values.jobTitle.trim()
  const salary = values.annualBaseSalary.trim()
  if (!fullName) errors.fullName = 'Full name is required'
  else if (fullName.length > 100) errors.fullName = 'Full name must be at most 100 characters'
  if (!jobTitle) errors.jobTitle = 'Job title is required'
  else if (jobTitle.length > 100) errors.jobTitle = 'Job title must be at most 100 characters'
  if (!values.countryCode) errors.countryCode = 'Country is required'
  if (!salary) errors.annualBaseSalary = 'Annual base salary is required'
  else if (!AMOUNT_PATTERN.test(salary)) {
    errors.annualBaseSalary = 'Enter a number with at most two decimal places, e.g. 85000.00'
  } else if (Number(salary) <= 0) errors.annualBaseSalary = 'Annual base salary must be greater than zero'
  if (!values.structureId) errors.structureId = 'Salary structure is required'
  return errors
}

/** FR-EMP-01 (add) and FR-EMP-03 (edit). */
export function EmployeeFormPage() {
  const { id } = useParams()
  return id ? <EditEmployee id={Number(id)} /> : <EmployeeForm />
}

function EditEmployee({ id }: { id: number }) {
  const employee = useEmployee(id)
  if (employee.isPending) return <LoadingState rows={8} />
  if (employee.isError) {
    const status = getStatus(employee.error)
    if (status === 404 || status === 400) {
      return <EmptyState title="Employee not found" description="This employee does not exist." />
    }
    return <ErrorState error={employee.error} onRetry={() => employee.refetch()} />
  }
  return <EmployeeForm employee={employee.data} />
}

function EmployeeForm({ employee }: { employee?: EmployeeDetail }) {
  const navigate = useNavigate()
  const isEdit = employee !== undefined
  const initial: FormValues = {
    fullName: employee?.fullName ?? '',
    jobTitle: employee?.jobTitle ?? '',
    countryCode: employee?.country.code ?? '',
    annualBaseSalary: employee?.annualBaseSalary.amount ?? '',
    structureId: employee ? String(employee.structure.id) : '',
  }
  const [values, setValues] = useState<FormValues>(initial)
  const [errors, setErrors] = useState<FormErrors>({})
  const [created, setCreated] = useState<{ id: number; loginId: string; password: string } | null>(null)

  const countries = useCountries()
  const structures = useStructures(values.countryCode || undefined)
  const jobTitles = useJobTitles()
  const create = useCreateEmployee()
  const update = useUpdateEmployee(employee?.id ?? 0)
  const mutation = isEdit ? update : create

  const country = countries.data?.find((c) => c.code === values.countryCode)
  const countryChanged = isEdit && values.countryCode !== initial.countryCode

  const setField = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // FR-EMP-01/03: the country sets the currency and the structures on offer. A salary in the
  // old currency is never carried over, so it must be entered again (or restored if the
  // employee's own country is chosen again).
  const onCountryChange = (code: string) => {
    const backToOriginal = isEdit && code === initial.countryCode
    setValues((prev) => ({
      ...prev,
      countryCode: code,
      annualBaseSalary: backToOriginal ? initial.annualBaseSalary : '',
      structureId: backToOriginal ? initial.structureId : '',
    }))
    setErrors((prev) => ({ ...prev, countryCode: undefined, annualBaseSalary: undefined, structureId: undefined }))
  }

  // FR-EMP-06: the standard monthly salary updates as values change, before saving.
  const debouncedSalary = useDebouncedValue(values.annualBaseSalary.trim())
  const canPreview =
    !!values.countryCode &&
    !!values.structureId &&
    AMOUNT_PATTERN.test(debouncedSalary) &&
    Number(debouncedSalary) > 0 &&
    structures.data?.some((s) => String(s.id) === values.structureId) === true
  const preview = useSalaryPreview(
    canPreview
      ? {
          countryCode: values.countryCode,
          annualBaseSalary: debouncedSalary,
          structureId: Number(values.structureId),
        }
      : null,
  )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const input = {
      fullName: values.fullName.trim(),
      jobTitle: values.jobTitle.trim(),
      countryCode: values.countryCode,
      annualBaseSalary: values.annualBaseSalary.trim(),
      structureId: Number(values.structureId),
    }
    const onError = (error: unknown) => setErrors(getFieldErrors(error))

    if (employee) {
      update.mutate(input, {
        onSuccess: () => {
          toast.success('Employee updated')
          navigate(`/employees/${employee.id}`)
        },
        onError,
      })
    } else {
      create.mutate(input, {
        onSuccess: ({ employee: saved, temporaryPassword }) => {
          toast.success(`${saved.fullName} added as ${saved.employeeCode}`)
          setCreated({ id: saved.id, loginId: saved.employeeCode, password: temporaryPassword })
        },
        onError,
      })
    }
  }

  const backTo = employee ? `/employees/${employee.id}` : '/employees'
  const serverMessage =
    mutation.isError && Object.keys(getFieldErrors(mutation.error)).length === 0
      ? getErrorMessage(mutation.error)
      : null

  return (
    <>
      <PageHeader
        back={{ to: backTo, label: employee ? employee.fullName : 'Employees' }}
        title={employee ? `Edit ${employee.fullName}` : 'Add employee'}
        description={employee ? employee.employeeCode : 'An Employee ID and login are created when you save.'}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit">
          <CardContent>
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                {serverMessage && (
                  <Alert variant="destructive">
                    <AlertTitle>Not saved</AlertTitle>
                    <AlertDescription>{serverMessage}</AlertDescription>
                  </Alert>
                )}

                <Field data-invalid={!!errors.fullName}>
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input
                    id="fullName"
                    value={values.fullName}
                    onChange={(e) => setField('fullName', e.target.value)}
                    aria-invalid={!!errors.fullName}
                    maxLength={100}
                  />
                  <FieldError>{errors.fullName}</FieldError>
                </Field>

                <Field data-invalid={!!errors.jobTitle}>
                  <FieldLabel htmlFor="jobTitle">Job title</FieldLabel>
                  <Input
                    id="jobTitle"
                    list="job-title-options"
                    value={values.jobTitle}
                    onChange={(e) => setField('jobTitle', e.target.value)}
                    aria-invalid={!!errors.jobTitle}
                    maxLength={100}
                  />
                  <datalist id="job-title-options">
                    {jobTitles.data?.map((title) => <option key={title} value={title} />)}
                  </datalist>
                  <FieldError>{errors.jobTitle}</FieldError>
                </Field>

                <Field data-invalid={!!errors.countryCode}>
                  <FieldLabel htmlFor="countryCode">Country</FieldLabel>
                  <Select value={values.countryCode} onValueChange={onCountryChange}>
                    <SelectTrigger id="countryCode" className="w-full" aria-invalid={!!errors.countryCode}>
                      <SelectValue placeholder="Choose a country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.data?.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.currencyCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {countryChanged && (
                    <FieldDescription>
                      Changing country: enter the salary in {country?.currencyCode} and choose a structure for{' '}
                      {country?.name}. The old amount is not converted.
                    </FieldDescription>
                  )}
                  <FieldError>{errors.countryCode}</FieldError>
                </Field>

                <Field data-invalid={!!errors.annualBaseSalary}>
                  <FieldLabel htmlFor="annualBaseSalary">
                    Annual base salary{country && ` (${country.currencyCode})`}
                  </FieldLabel>
                  <Input
                    id="annualBaseSalary"
                    inputMode="decimal"
                    placeholder={country ? 'e.g. 85000.00' : 'Choose a country first'}
                    disabled={!country}
                    value={values.annualBaseSalary}
                    onChange={(e) => setField('annualBaseSalary', e.target.value)}
                    aria-invalid={!!errors.annualBaseSalary}
                  />
                  <FieldError>{errors.annualBaseSalary}</FieldError>
                </Field>

                <Field data-invalid={!!errors.structureId}>
                  <FieldLabel htmlFor="structureId">Salary structure</FieldLabel>
                  <Select
                    value={values.structureId}
                    onValueChange={(value) => setField('structureId', value)}
                    disabled={!country || structures.isPending}
                  >
                    <SelectTrigger id="structureId" className="w-full" aria-invalid={!!errors.structureId}>
                      <SelectValue placeholder={country ? 'Choose a structure' : 'Choose a country first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {country &&
                        structures.data?.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.structureId}</FieldError>
                </Field>

                <div className="flex gap-2">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => navigate(backTo)}>
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Standard monthly salary</CardTitle>
            <CardDescription>
              Preview with no overtime, no bonus and 100% variable pay achievement. Nothing is saved yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canPreview ? (
              <p className="text-sm text-muted-foreground">
                Choose a country and structure and enter a salary to see the monthly breakdown.
              </p>
            ) : preview.isPending ? (
              <LoadingState rows={6} />
            ) : preview.isError ? (
              <ErrorState error={preview.error} />
            ) : (
              <div className={preview.isFetching ? 'opacity-60 transition-opacity' : undefined}>
                <PayBreakdownTable {...preview.data.standardMonthlySalary} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TemporaryPasswordDialog
        credentials={created}
        onClose={() => created && navigate(`/employees/${created.id}`)}
      />
    </>
  )
}
