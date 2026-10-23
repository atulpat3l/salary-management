import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
import { useCreateRun, usePayrollRuns } from '@/api/payroll'
import { getErrorMessage } from '@/lib/api'
import { currentMonth, formatDate, formatMoney, formatMonth } from '@/lib/format'

/** FR-PAY-07: every run by month with status, headcount and per-country net totals. */
export function PayrollRunsPage() {
  const navigate = useNavigate()
  const runs = usePayrollRuns()

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Monthly payroll runs: enter inputs, calculate, finalise and record payment."
        actions={<NewRunDialog />}
      />
      <Card>
        <CardContent>
          {runs.isPending ? (
            <LoadingState rows={6} />
          ) : runs.isError ? (
            <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
          ) : runs.data.length === 0 ? (
            <EmptyState
              title="No payroll runs yet"
              description="Start a run for a month to calculate everyone's pay."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Headcount</TableHead>
                  <TableHead>Net pay by country</TableHead>
                  <TableHead>Payment date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => navigate(`/payroll/${run.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/payroll/${run.id}`)}
                  >
                    <TableCell className="font-medium">{formatMonth(run.month)}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {run.summary.headcount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {run.summary.byCountry.length === 0 ? (
                        <span className="text-muted-foreground">Not calculated</span>
                      ) : (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {run.summary.byCountry.map((c) => (
                            <li key={c.countryCode} className="tabular-nums">
                              <span className="text-muted-foreground">{c.countryCode}</span>{' '}
                              {formatMoney(c.net)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(run.paymentDate)}</TableCell>
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

function NewRunDialog() {
  const navigate = useNavigate()
  const createRun = useCreateRun()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(currentMonth())

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    createRun.mutate(month, {
      onSuccess: (run) => {
        setOpen(false)
        navigate(`/payroll/${run.id}`)
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) createRun.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          New payroll run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New payroll run</DialogTitle>
            <DialogDescription>There can be one payroll run per month.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={createRun.isError}>
            <FieldLabel htmlFor="run-month">Month</FieldLabel>
            <Input
              id="run-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-invalid={createRun.isError}
              required
            />
            <FieldError>{createRun.isError && getErrorMessage(createRun.error)}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={!month || createRun.isPending}>
              {createRun.isPending ? 'Creating…' : 'Create run'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
