import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useMyDisbursements } from '@/api/me'
import { formatDate, formatMoney, formatMonth } from '@/lib/format'

/** FR-ESS-03: what was paid and when; finalised months not yet paid show as Pending. */
export function DisbursementsPage() {
  const disbursements = useMyDisbursements()

  return (
    <>
      <PageHeader title="Disbursements" description="Your salary payment history." />
      <Card>
        <CardContent>
          {disbursements.isPending ? (
            <LoadingState rows={6} />
          ) : disbursements.isError ? (
            <ErrorState error={disbursements.error} onRetry={() => disbursements.refetch()} />
          ) : disbursements.data.length === 0 ? (
            <EmptyState title="No payments yet" description="Payments appear here once your payroll has been finalised." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Net paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disbursements.data.map((d) => (
                  <TableRow key={d.payslipId}>
                    <TableCell>
                      <Link to={`/payslips/${d.payslipId}`} className="font-medium hover:underline">
                        {formatMonth(d.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.netPaid)}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell>{formatDate(d.paymentDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
