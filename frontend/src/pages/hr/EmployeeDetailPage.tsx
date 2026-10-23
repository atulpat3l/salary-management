import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { KeyRoundIcon, PencilIcon, UserXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmButton } from '@/components/ConfirmButton'
import { DetailList } from '@/components/DetailList'
import { PageHeader } from '@/components/PageHeader'
import { PayBreakdownTable } from '@/components/PayBreakdownTable'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { TemporaryPasswordDialog } from '@/components/TemporaryPasswordDialog'
import { useDeactivateEmployee, useEmployee, useResetPassword } from '@/api/employees'
import { getErrorMessage, getStatus } from '@/lib/api'
import { formatDateTime, formatMoney } from '@/lib/format'

const BACK = { to: '/employees', label: 'Employees' }

/** FR-EMP-02: everything about one employee, with their standard monthly salary (FR-EMP-06). */
export function EmployeeDetailPage() {
  const id = Number(useParams().id)
  const employee = useEmployee(id)
  const deactivate = useDeactivateEmployee(id)
  const resetPassword = useResetPassword(id)
  const [credentials, setCredentials] = useState<{ loginId: string; password: string } | null>(null)

  if (employee.isPending) return <LoadingState rows={8} />
  if (employee.isError) {
    if (getStatus(employee.error) === 404 || getStatus(employee.error) === 400) {
      return (
        <>
          <PageHeader title="Employee not found" back={BACK} />
          <EmptyState title="Employee not found" description="This employee does not exist." />
        </>
      )
    }
    return <ErrorState error={employee.error} onRetry={() => employee.refetch()} />
  }

  const e = employee.data
  const isActive = e.status === 'ACTIVE'
  const pay = e.standardMonthlySalary

  const onDeactivate = () =>
    deactivate.mutate(undefined, {
      onSuccess: () => toast.success(`${e.fullName} has been deactivated`),
      onError: (error) => toast.error(getErrorMessage(error)),
    })

  const onResetPassword = () =>
    resetPassword.mutate(undefined, {
      onSuccess: ({ temporaryPassword }) =>
        setCredentials({ loginId: e.employeeCode, password: temporaryPassword }),
      onError: (error) => toast.error(getErrorMessage(error)),
    })

  return (
    <>
      <PageHeader
        back={BACK}
        title={
          <span className="flex items-center gap-3">
            {e.fullName} <StatusBadge status={e.status} />
          </span>
        }
        description={`${e.employeeCode} · ${e.jobTitle} · ${e.country.name}`}
        actions={
          isActive && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/employees/${e.id}/edit`}>
                  <PencilIcon />
                  Edit
                </Link>
              </Button>
              <ConfirmButton
                icon={<KeyRoundIcon />}
                label="Reset password"
                title="Reset this employee's password?"
                description="A new temporary password will be created. Their current password stops working and they will be logged out everywhere."
                confirmLabel="Reset password"
                pending={resetPassword.isPending}
                onConfirm={onResetPassword}
              />
              <ConfirmButton
                variant="destructive"
                icon={<UserXIcon />}
                label="Deactivate"
                title={`Deactivate ${e.fullName}?`}
                description="They will be excluded from future payroll runs and insights, and can no longer log in. Their past payslips and disbursements are kept. This cannot be undone here."
                confirmLabel="Deactivate"
                pending={deactivate.isPending}
                onConfirm={onDeactivate}
              />
            </>
          )
        }
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Employee ID', value: e.employeeCode },
                { label: 'Full name', value: e.fullName },
                { label: 'Job title', value: e.jobTitle },
                { label: 'Country', value: e.country.name },
                { label: 'Currency', value: e.currency },
                { label: 'Annual base salary', value: formatMoney(e.annualBaseSalary) },
                { label: 'Salary structure', value: e.structure.name },
                { label: 'Status', value: <StatusBadge status={e.status} /> },
                { label: 'Last updated', value: formatDateTime(e.updatedAt) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Standard monthly salary</CardTitle>
            <CardDescription>
              No overtime, no bonus and 100% variable pay achievement, in {e.currency}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PayBreakdownTable
              earnings={pay.earnings}
              deductions={pay.deductions}
              gross={pay.gross}
              totalDeductions={pay.totalDeductions}
              net={pay.net}
            />
          </CardContent>
        </Card>
      </div>

      <TemporaryPasswordDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  )
}
