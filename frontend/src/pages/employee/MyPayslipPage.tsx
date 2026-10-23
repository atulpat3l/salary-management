import { useParams } from 'react-router'
import { PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { PayslipView } from '@/components/PayslipView'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useMyPayslip } from '@/api/me'
import { getStatus } from '@/lib/api'
import { formatMonth } from '@/lib/format'

const BACK = { to: '/payslips', label: 'My payslips' }

/** FR-ESS-02: one payslip exactly as issued, printable (FR-ESS-05). */
export function MyPayslipPage() {
  const id = Number(useParams().id)
  const payslip = useMyPayslip(id)

  if (payslip.isPending) return <LoadingState rows={8} />
  if (payslip.isError) {
    const status = getStatus(payslip.error)
    if (status === 404 || status === 400) {
      return (
        <>
          <PageHeader title="Payslip not found" back={BACK} />
          <EmptyState title="Payslip not found" description="This payslip does not exist or is not yours." />
        </>
      )
    }
    return <ErrorState error={payslip.error} onRetry={() => payslip.refetch()} />
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={BACK}
          title={`Payslip · ${formatMonth(payslip.data.month)}`}
          actions={
            <Button variant="outline" onClick={() => window.print()}>
              <PrinterIcon />
              Print
            </Button>
          }
        />
      </div>
      <PayslipView payslip={payslip.data} />
    </>
  )
}
