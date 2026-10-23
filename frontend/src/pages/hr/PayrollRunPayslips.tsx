import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Pagination } from '@/components/Pagination'
import { PayslipView } from '@/components/PayslipView'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useRunPayslip, useRunPayslips } from '@/api/payroll'
import { formatMoney } from '@/lib/format'
import type { PayrollRun } from '@/lib/types'

const ALL = 'all'

/** FR-PAY-03: every employee's pay in the run, filterable to one country or the flagged ones. */
export function PayrollRunPayslips({ run }: { run: PayrollRun }) {
  const [country, setCountry] = useState(ALL)
  const [show, setShow] = useState<'all' | 'flagged'>('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(null)

  const payslips = useRunPayslips(run.id, {
    country: country === ALL ? undefined : country,
    flagged: show === 'flagged' ? true : undefined,
    page,
    pageSize: 25,
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payslip-country">Country</Label>
            <Select
              value={country}
              onValueChange={(value) => {
                setCountry(value)
                setPage(1)
              }}
            >
              <SelectTrigger id="payslip-country" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All countries</SelectItem>
                {run.summary.byCountry.map((c) => (
                  <SelectItem key={c.countryCode} value={c.countryCode}>
                    {c.countryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payslip-show">Show</Label>
            <Select
              value={show}
              onValueChange={(value) => {
                setShow(value as 'all' | 'flagged')
                setPage(1)
              }}
            >
              <SelectTrigger id="payslip-show" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                <SelectItem value="flagged">Flagged only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {payslips.isPending ? (
          <LoadingState rows={8} />
        ) : payslips.isError ? (
          <ErrorState error={payslips.error} onRetry={() => payslips.refetch()} />
        ) : payslips.data.items.length === 0 ? (
          <EmptyState title={show === 'flagged' ? 'No flagged employees' : 'No payslips'} />
        ) : (
          <div className={payslips.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Gross pay</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.data.items.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => setOpenId(p.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setOpenId(p.id)}
                  >
                    <TableCell className="font-mono text-xs">{p.employeeCode}</TableCell>
                    <TableCell className="font-medium">{p.fullName}</TableCell>
                    <TableCell>{p.country.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.totalDeductions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.net)}</TableCell>
                    <TableCell>{p.flagged && <Badge variant="destructive">Flagged</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={payslips.data.page}
              totalPages={payslips.data.totalPages}
              total={payslips.data.total}
              noun="payslips"
              onPageChange={setPage}
            />
          </div>
        )}
      </CardContent>
      <PayslipDialog runId={run.id} payslipId={openId} onClose={() => setOpenId(null)} />
    </Card>
  )
}

function PayslipDialog({
  runId,
  payslipId,
  onClose,
}: {
  runId: number
  payslipId: number | null
  onClose: () => void
}) {
  const payslip = useRunPayslip(runId, payslipId)
  return (
    <Dialog open={payslipId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Payslip</DialogTitle>
        </DialogHeader>
        {payslip.isPending ? (
          <LoadingState rows={8} />
        ) : payslip.isError ? (
          <ErrorState error={payslip.error} onRetry={() => payslip.refetch()} />
        ) : (
          <PayslipView payslip={payslip.data} />
        )}
      </DialogContent>
    </Dialog>
  )
}
