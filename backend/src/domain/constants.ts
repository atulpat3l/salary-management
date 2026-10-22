// Allowed values for the enum-like String columns in prisma/schema.prisma.
// SQLite has no native enums, so these lists are the single source of truth for validation.

export const ROLES = ['HR', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** FR-PAY-06: a run only moves forward, DRAFT → FINALISED → DISBURSED. */
export const PAYROLL_STATUSES = ['DRAFT', 'FINALISED', 'DISBURSED'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export const STRUCTURE_STYLES = ['STANDARD', 'SALES', 'HOURLY'] as const;
export type StructureStyle = (typeof STRUCTURE_STYLES)[number];

export const COMPONENT_KINDS = ['EARNING', 'DEDUCTION'] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

/** PCT_BASE: % of monthly base · PCT_GROSS: % of gross pay (deductions only) · FIXED: fixed monthly amount */
export const COMPONENT_BASES = ['PCT_BASE', 'PCT_GROSS', 'FIXED'] as const;
export type ComponentBasis = (typeof COMPONENT_BASES)[number];
