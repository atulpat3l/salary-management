import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailList } from '@/components/DetailList'
import { PayBreakdownTable } from '@/components/PayBreakdownTable'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate, formatMoney, formatMonth } from '@/lib/format'
import type { PayslipDetail } from '@/lib/types'

/**
 * A payslip exactly as stored (FR-ESS-02, FR-PAY-03): who it is for, the month's inputs,
 * every line, and the payment status. Shown to HR in a run and to the employee themselves.
 */
export function PayslipView({ payslip }: { payslip: PayslipDetail }) {
  return (
    <div className="flex flex-col gap-4">
      {payslip.flagged && (
        <Alert variant="destructive">
          <AlertTitle>Flagged for review</AlertTitle>
          <AlertDescription>
            Deductions exceed gross pay. Adjust this employee's inputs or details and recalculate before
            finalising.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            {payslip.fullName} · {formatMonth(payslip.month)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList
            items={[
              { label: 'Employee ID', value: payslip.employeeCode },
              { label: 'Job title', value: payslip.jobTitle },
              { label: 'Country', value: payslip.country.name },
              { label: 'Currency', value: payslip.currency },
              { label: 'Salary structure', value: payslip.structureName },
              { label: 'Annual base salary', value: formatMoney(payslip.annualBaseSalary) },
              { label: 'Overtime hours', value: payslip.inputs.overtimeHours },
              { label: 'Bonus', value: formatMoney(payslip.inputs.bonus) },
              { label: 'Variable pay achievement', value: `${payslip.inputs.achievementPct}%` },
              { label: 'Payment status', value: <StatusBadge status={payslip.paymentStatus} /> },
              { label: 'Payment date', value: formatDate(payslip.paymentDate) },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <PayBreakdownTable
            earnings={payslip.earnings}
            deductions={payslip.deductions}
            gross={payslip.gross}
            totalDeductions={payslip.totalDeductions}
            net={payslip.net}
          />
        </CardContent>
      </Card>
    </div>
  )
}
