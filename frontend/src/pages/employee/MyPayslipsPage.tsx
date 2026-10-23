import { Link, useNavigate } from 'react-router'
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
import { useMyPayslips } from '@/api/me'
import { formatDate, formatMoney, formatMonth } from '@/lib/format'

/** FR-ESS-01: the employee home view, issued payslips newest first. */
export function MyPayslipsPage() {
  const navigate = useNavigate()
  const payslips = useMyPayslips()

  return (
    <>
      <PageHeader title="My payslips" description="Your payslips by month, once payroll has been finalised." />
      <Card>
        <CardContent>
          {payslips.isPending ? (
            <LoadingState rows={6} />
          ) : payslips.isError ? (
            <ErrorState error={payslips.error} onRetry={() => payslips.refetch()} />
          ) : payslips.data.length === 0 ? (
            <EmptyState
              title="No payslips yet"
              description="Your first payslip will appear here once the payroll for your first month has been finalised."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Gross pay</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.data.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/payslips/${p.id}`)}>
                    <TableCell>
                      <Link
                        to={`/payslips/${p.id}`}
                        className="font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {formatMonth(p.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.totalDeductions)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(p.net)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.paymentStatus} />
                    </TableCell>
                    <TableCell>{formatDate(p.paymentDate)}</TableCell>
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
