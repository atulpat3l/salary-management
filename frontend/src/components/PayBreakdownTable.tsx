import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney } from '@/lib/format'
import type { Money, PayLine } from '@/lib/types'

interface PayBreakdownTableProps {
  earnings: PayLine[]
  deductions: PayLine[]
  gross: Money
  totalDeductions: Money
  net: Money
}

/** Every earning and deduction line with how it was worked out (PRD §5.7), then the totals. */
export function PayBreakdownTable({ earnings, deductions, gross, totalDeductions, net }: PayBreakdownTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Line</TableHead>
          <TableHead>Calculation</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <SectionRow label="Earnings" />
        {earnings.map((line) => (
          <LineRow key={`e-${line.label}`} line={line} />
        ))}
        <TotalRow label="Gross pay" amount={gross} />
        <SectionRow label="Deductions" />
        {deductions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-muted-foreground">
              No deductions
            </TableCell>
          </TableRow>
        ) : (
          deductions.map((line) => <LineRow key={`d-${line.label}`} line={line} />)
        )}
        <TotalRow label="Total deductions" amount={totalDeductions} />
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2} className="font-semibold">
            Net pay
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{formatMoney(net)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function SectionRow({ label }: { label: string }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={3} className="pt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </TableCell>
    </TableRow>
  )
}

function LineRow({ line }: { line: PayLine }) {
  return (
    <TableRow>
      <TableCell>{line.label}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">{line.calculation}</TableCell>
      <TableCell className="text-right tabular-nums">{formatMoney(line.amount)}</TableCell>
    </TableRow>
  )
}

function TotalRow({ label, amount }: { label: string; amount: Money }) {
  return (
    <TableRow className="font-medium">
      <TableCell colSpan={2}>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{formatMoney(amount)}</TableCell>
    </TableRow>
  )
}
