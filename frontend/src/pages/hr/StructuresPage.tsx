import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState } from '@/components/states'
import { useCountries } from '@/api/employees'
import { useStructures } from '@/api/structures'
import { formatMoney } from '@/lib/format'
import type { Structure, StructureComponent } from '@/lib/types'

const ALL = 'all'

const BASIS_LABELS: Record<StructureComponent['basis'], string> = {
  PCT_BASE: 'of monthly base',
  PCT_GROSS: 'of gross pay',
  FIXED: 'fixed monthly',
}

/** FR-STR-02: read-only view of every country's predefined salary structures. */
export function StructuresPage() {
  const [country, setCountry] = useState(ALL)
  const countries = useCountries()
  const structures = useStructures(country === ALL ? undefined : country)

  return (
    <>
      <PageHeader
        title="Salary structures"
        description="Predefined, country-specific templates that determine how monthly pay is built."
      />
      <div className="mb-6 flex flex-col gap-1.5">
        <Label htmlFor="structure-country">Country</Label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger id="structure-country" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All countries</SelectItem>
            {countries.data?.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {structures.isPending ? (
        <LoadingState rows={6} />
      ) : structures.isError ? (
        <ErrorState error={structures.error} onRetry={() => structures.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {structures.data.map((s) => (
            <StructureCard key={s.id} structure={s} />
          ))}
        </div>
      )}
    </>
  )
}

function StructureCard({ structure: s }: { structure: Structure }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {s.name}
          <Badge variant="secondary">{s.style.charAt(0) + s.style.slice(1).toLowerCase()}</Badge>
        </CardTitle>
        <CardDescription>
          {s.country.name} · {s.currency}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-3 gap-2">
          <Rule label="Variable pay target" value={`${s.variableTargetPct}%`} />
          <Rule label="Standard hours" value={`${s.standardMonthlyHours} / month`} />
          <Rule label="Overtime" value={`${s.overtimeMultiplier}×`} />
        </dl>
        <Separator />
        <ComponentList title="Earnings" components={s.earnings} />
        <ComponentList title="Deductions" components={s.deductions} />
      </CardContent>
    </Card>
  )
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function ComponentList({ title, components }: { title: string; components: StructureComponent[] }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {components.length === 0 ? (
        <p className="text-muted-foreground">None</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {components.map((c) => (
            <li key={c.name} className="flex justify-between gap-2">
              <span>{c.name}</span>
              <span className="text-right text-muted-foreground tabular-nums">
                {c.basis === 'FIXED' ? formatMoney(c.amount) : `${c.percent}%`} {BASIS_LABELS[c.basis]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
