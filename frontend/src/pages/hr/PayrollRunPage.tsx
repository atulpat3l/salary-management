import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { BanknoteIcon, CalculatorIcon, LockIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmButton } from '@/components/ConfirmButton'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCalculateRun, useDisburseRun, useFinaliseRun, usePayrollRun } from '@/api/payroll'
import { getErrorMessage, getFieldErrors, getStatus } from '@/lib/api'
import { formatDate, formatDateTime, formatMoney, formatMonth, today } from '@/lib/format'
import type { PayrollRun } from '@/lib/types'
import { PayrollRunInputs } from './PayrollRunInputs'
import { PayrollRunPayslips } from './PayrollRunPayslips'

const BACK = { to: '/payroll', label: 'Payroll' }

/** FR-PAY-01..06: one month's run. Draft → Calculate → Finalise → Mark disbursed. */
export function PayrollRunPage() {
  const id = Number(useParams().id)
  const run = usePayrollRun(id)

  if (run.isPending) return <LoadingState rows={8} />
  if (run.isError) {
    const status = getStatus(run.error)
    if (status === 404 || status === 400) {
      return (
        <>
          <PageHeader title="Payroll run not found" back={BACK} />
          <EmptyState title="Payroll run not found" description="This payroll run does not exist." />
        </>
      )
    }
    return <ErrorState error={run.error} onRetry={() => run.refetch()} />
  }

  const r = run.data
  const isDraft = r.status === 'DRAFT'
  const calculated = r.calculatedAt !== null

  return (
    <>
      <PageHeader
        back={BACK}
        title={
          <span className="flex items-center gap-3">
            {formatMonth(r.month)} <StatusBadge status={r.status} />
          </span>
        }
        description={<RunTimeline run={r} />}
        actions={<RunActions run={r} />}
      />

      <div className="flex flex-col gap-6">
        {r.summary.flaggedCount > 0 && (
          <Alert variant="destructive">
            <AlertTitle>
              {r.summary.flaggedCount} employee{r.summary.flaggedCount === 1 ? ' is' : 's are'} flagged
            </AlertTitle>
            <AlertDescription>
              Their deductions exceed gross pay. Review them in the payslips below, adjust inputs or employee
              details, and recalculate. The run cannot be finalised until this is resolved.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Summary by country</CardTitle>
            <CardDescription>
              {calculated
                ? `${r.summary.headcount.toLocaleString()} employees. Totals are per country, each in its own currency.`
                : 'Not calculated yet. Enter any monthly inputs, then calculate.'}
            </CardDescription>
          </CardHeader>
          {calculated && r.summary.byCountry.length > 0 && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Headcount</TableHead>
                    <TableHead className="text-right">Flagged</TableHead>
                    <TableHead className="text-right">Gross pay</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.summary.byCountry.map((c) => (
                    <TableRow key={c.countryCode}>
                      <TableCell className="font-medium">{c.countryName}</TableCell>
                      <TableCell>{c.currency}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.headcount.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.flaggedCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.totalDeductions)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(c.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>

        <Tabs defaultValue={isDraft ? 'inputs' : 'payslips'}>
          <TabsList>
            <TabsTrigger value="inputs">Monthly inputs</TabsTrigger>
            <TabsTrigger value="payslips">Payslips</TabsTrigger>
          </TabsList>
          <TabsContent value="inputs">
            <PayrollRunInputs runId={r.id} editable={isDraft} />
          </TabsContent>
          <TabsContent value="payslips">
            {calculated ? (
              <PayrollRunPayslips run={r} />
            ) : (
              <EmptyState title="No payslips yet" description="Calculate the run to see each employee's pay." />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function RunTimeline({ run }: { run: PayrollRun }) {
  const parts = [`Created ${formatDateTime(run.createdAt)}`]
  if (run.calculatedAt) parts.push(`calculated ${formatDateTime(run.calculatedAt)}`)
  if (run.finalisedAt) parts.push(`finalised ${formatDateTime(run.finalisedAt)}`)
  if (run.paymentDate) parts.push(`paid on ${formatDate(run.paymentDate)}`)
  return <>{parts.join(' · ')}</>
}

/** The next step for the run's status. Status only moves forward (FR-PAY-06). */
function RunActions({ run }: { run: PayrollRun }) {
  const calculate = useCalculateRun(run.id)
  const finalise = useFinaliseRun(run.id)

  if (run.status === 'FINALISED') return <DisburseDialog run={run} />
  if (run.status !== 'DRAFT') return null

  const busy = calculate.isPending || finalise.isPending

  return (
    <>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          calculate.mutate(undefined, {
            onSuccess: (updated) =>
              toast.success(`Calculated pay for ${updated.summary.headcount.toLocaleString()} employees`),
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      >
        <CalculatorIcon />
        {calculate.isPending ? 'Calculating…' : run.calculatedAt ? 'Recalculate' : 'Calculate'}
      </Button>
      <ConfirmButton
        variant="default"
        icon={<LockIcon />}
        label={finalise.isPending ? 'Finalising…' : 'Finalise'}
        title={`Finalise payroll for ${formatMonth(run.month)}?`}
        description="Pay is calculated once more from current data, the run is locked and payslips are issued to every included employee. This cannot be undone."
        confirmLabel="Finalise and issue payslips"
        pending={busy}
        disabled={!run.calculatedAt || run.summary.flaggedCount > 0}
        onConfirm={() =>
          finalise.mutate(undefined, {
            onSuccess: () => toast.success('Payroll finalised. Payslips are now visible to employees.'),
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      />
    </>
  )
}

/** FR-PAY-06: record the payment date of a finalised run. */
function DisburseDialog({ run }: { run: PayrollRun }) {
  const disburse = useDisburseRun(run.id)
  const [open, setOpen] = useState(false)
  const [paymentDate, setPaymentDate] = useState(today())
  const fieldError = disburse.isError
    ? (getFieldErrors(disburse.error).paymentDate ?? getErrorMessage(disburse.error))
    : null

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    disburse.mutate(paymentDate, {
      onSuccess: () => {
        setOpen(false)
        toast.success(`${formatMonth(run.month)} marked as paid on ${formatDate(paymentDate)}`)
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) disburse.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <BanknoteIcon />
          Mark disbursed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Mark {formatMonth(run.month)} as paid</DialogTitle>
            <DialogDescription>
              Every payslip in this run will show as Paid with this payment date. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!fieldError}>
            <FieldLabel htmlFor="payment-date">Payment date</FieldLabel>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              min={`${run.month}-01`}
              max={today()}
              onChange={(e) => setPaymentDate(e.target.value)}
              aria-invalid={!!fieldError}
              required
            />
            <FieldError>{fieldError}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={!paymentDate || disburse.isPending}>
              {disburse.isPending ? 'Saving…' : 'Mark disbursed'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
