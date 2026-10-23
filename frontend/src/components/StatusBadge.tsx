import { Badge } from '@/components/ui/badge'
import type { EmployeeStatus, PaymentStatus, PayrollStatus } from '@/lib/types'

type Status = EmployeeStatus | PayrollStatus | PaymentStatus

// Every status is spelled out in words, so it is never conveyed by colour alone (NFR-09).
const LABELS: Record<Status, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DRAFT: 'Draft',
  FINALISED: 'Finalised',
  DISBURSED: 'Disbursed',
  PENDING: 'Pending',
  PAID: 'Paid',
}

const VARIANTS: Record<Status, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'outline',
  DRAFT: 'outline',
  FINALISED: 'secondary',
  DISBURSED: 'default',
  PENDING: 'secondary',
  PAID: 'default',
}

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
}
