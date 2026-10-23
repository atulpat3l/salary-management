import { Link } from 'react-router'
import { KeyRoundIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailList } from '@/components/DetailList'
import { PageHeader } from '@/components/PageHeader'
import { PayBreakdownTable } from '@/components/PayBreakdownTable'
import { ErrorState, LoadingState } from '@/components/states'
import { useMyProfile } from '@/api/me'
import { formatMoney } from '@/lib/format'

/** FR-ESS-04: read-only profile with the standard monthly salary. */
export function ProfilePage() {
  const profile = useMyProfile()

  if (profile.isPending) return <LoadingState rows={8} />
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />

  const p = profile.data
  const pay = p.standardMonthlySalary

  return (
    <>
      <PageHeader
        title="My profile"
        description="Contact HR if any of these details are wrong."
        actions={
          <Button variant="outline" asChild>
            <Link to="/change-password">
              <KeyRoundIcon />
              Change password
            </Link>
          </Button>
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
                { label: 'Employee ID', value: p.employeeCode },
                { label: 'Full name', value: p.fullName },
                { label: 'Job title', value: p.jobTitle },
                { label: 'Country', value: p.country.name },
                { label: 'Currency', value: p.currency },
                { label: 'Annual base salary', value: formatMoney(p.annualBaseSalary) },
                { label: 'Salary structure', value: p.structure.name },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Standard monthly salary</CardTitle>
            <CardDescription>
              What you are normally paid each month: no overtime, no bonus and 100% variable pay achievement.
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
    </>
  )
}
