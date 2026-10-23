// Response shapes of the backend API (see backend/src/modules/*). Amounts are always
// paired with their currency and never combined across currencies.

export type Role = 'HR' | 'EMPLOYEE'
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE'
export type PayrollStatus = 'DRAFT' | 'FINALISED' | 'DISBURSED'
export type PaymentStatus = 'DRAFT' | 'PENDING' | 'PAID'
export type StructureStyle = 'STANDARD' | 'SALES' | 'HOURLY'

export interface Money {
  amount: string // exactly two decimals, e.g. "5000.00"
  currency: string // ISO 4217, e.g. "USD"
}

export interface CountryRef {
  code: string
  name: string
}

export interface Country extends CountryRef {
  currencyCode: string
  locale: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface User {
  loginId: string
  role: Role
  mustChangePassword: boolean
  employee: { id: number; employeeCode: string; fullName: string } | null
}

export interface PayLine {
  kind: string
  label: string
  calculation: string
  amount: Money
}

export interface PayBreakdown {
  earnings: PayLine[]
  deductions: PayLine[]
  gross: Money
  totalDeductions: Money
  net: Money
  flagged: boolean
}

export interface EmployeeListItem {
  id: number
  employeeCode: string
  fullName: string
  jobTitle: string
  country: CountryRef
  currency: string
  annualBaseSalary: Money
  standardMonthlyGross: Money
  standardMonthlyNet: Money
  status: EmployeeStatus
}

export interface EmployeeDetail {
  id: number
  employeeCode: string
  fullName: string
  jobTitle: string
  country: CountryRef
  currency: string
  annualBaseSalary: Money
  structure: { id: number; name: string; style: StructureStyle }
  status: EmployeeStatus
  standardMonthlySalary: PayBreakdown
  createdAt: string
  updatedAt: string
}

export interface EmployeeInput {
  fullName: string
  jobTitle: string
  countryCode: string
  annualBaseSalary: string
  structureId: number
}

export interface StructureComponent {
  name: string
  basis: 'PCT_BASE' | 'PCT_GROSS' | 'FIXED'
  percent: string | null
  amount: Money | null
}

export interface Structure {
  id: number
  name: string
  style: StructureStyle
  country: CountryRef
  currency: string
  variableTargetPct: string
  standardMonthlyHours: number
  overtimeMultiplier: string
  earnings: StructureComponent[]
  deductions: StructureComponent[]
}

export interface CountryTotals {
  countryCode: string
  countryName: string
  currency: string
  headcount: number
  flaggedCount: number
  gross: Money
  totalDeductions: Money
  net: Money
}

export interface PayrollRun {
  id: number
  month: string // YYYY-MM
  status: PayrollStatus
  calculatedAt: string | null
  finalisedAt: string | null
  disbursedAt: string | null
  paymentDate: string | null
  createdAt: string
  summary: { headcount: number; flaggedCount: number; byCountry: CountryTotals[] }
}

export interface PayrollInput {
  employeeId: number
  employeeCode: string
  fullName: string
  overtimeHours: string
  bonus: Money
  achievementPct: string
}

export interface PayslipSummary {
  id: number
  employeeId: number
  employeeCode: string
  fullName: string
  jobTitle: string
  country: CountryRef
  currency: string
  gross: Money
  totalDeductions: Money
  net: Money
  flagged: boolean
}

export interface PayslipDetail extends PayslipSummary {
  month: string
  run: { id: number; month: string; status: PayrollStatus }
  structureName: string
  annualBaseSalary: Money
  inputs: { overtimeHours: string; bonus: Money; achievementPct: string }
  earnings: PayLine[]
  deductions: PayLine[]
  paymentStatus: PaymentStatus
  paymentDate: string | null
}

export interface MyPayslip {
  id: number
  month: string
  currency: string
  gross: Money
  totalDeductions: Money
  net: Money
  paymentStatus: PaymentStatus
  paymentDate: string | null
}

export interface Disbursement {
  payslipId: number
  month: string
  netPaid: Money
  status: PaymentStatus
  paymentDate: string | null
}

export interface MyProfile {
  employeeCode: string
  fullName: string
  jobTitle: string
  country: CountryRef
  currency: string
  annualBaseSalary: Money
  structure: { name: string; style: StructureStyle }
  standardMonthlySalary: PayBreakdown
}

export interface SalaryStats {
  headcount: number
  minimum: Money | null
  maximum: Money | null
  average: Money | null
}

export interface CountryInsights extends SalaryStats {
  country: CountryRef
  currency: string
  message: string | null
}

export interface JobTitleInsights {
  country: CountryRef
  currency: string
  jobTitles: (SalaryStats & { jobTitle: string })[]
  message: string | null
}

export interface InsightsOverview {
  headcount: number
  countries: (SalaryStats & { country: CountryRef; currency: string })[]
}
