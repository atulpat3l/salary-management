# Product Requirements Document — Salary Management Tool

> **Scope of this document.** This PRD describes _what_ the product must do and _why_. It deliberately makes no technology, architecture or data-storage decisions — those are recorded separately in the design notes.

## 1. Background & Problem

An organisation of roughly **10,000 employees** spread across multiple countries manages salaries and monthly pay in spreadsheets (assumed). Each country pays in its own currency. This creates problems for two groups:

**For HR**

1. **Records are hard to maintain.** Adding, correcting or removing employees means editing large files by hand, with no validation.
2. **Monthly pay is calculated manually.** Every month HR works out each employee's gross pay, variable pay, bonuses, overtime and deductions with spreadsheet formulas. That is slow, error-prone and hard to audit.
3. **Currencies get mixed up.** With many countries in one spreadsheet, it is easy to compare or total amounts in different currencies by mistake.
4. **There is no aggregate view.** Questions like _"What is the salary range in India?"_ need manual formulas that are rebuilt every time.

**For employees** 5. **No self-service access to pay information.** Employees must ask HR for payslips or confirmation of past payments, which creates repetitive requests and delays.

**Problem statement:** _HR needs one reliable place to maintain salary records in each country's own currency, see every employee's monthly salary, run accurate monthly payroll automatically and answer compensation questions in seconds. Employees need secure self-service access to their own payslips and payment history._

---

## 2. Assumptions

The original brief was summarised rather than quoted in full; the following assumptions fill the gaps. Each is flagged so it can be confirmed or corrected.

| ID  | Assumption                                                                                                                                                                                                                              | Impact if wrong                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A1  | There are two user roles: **HR Manager** (manages everything) and **Employee** (views only their own pay information).                                                                                                                  | More roles (e.g. finance approver, line manager) would need extra permissions and views.           |
| A2  | Each employee has an **annual base salary**. Their monthly salary is derived from it using their assigned salary structure.                                                                                                             | A different pay basis (hourly, monthly fixed) would change the calculation rules.                  |
| A3  | **Currency is tied to country.** Each supported country has exactly one currency. An employee's salary and every amount calculated from it are in their country's currency. Amounts are **never converted** to another currency.        | Paying some employees in a currency other than their country's would need a per-employee currency. |
| A4  | The tool supports a **defined list of countries**, each with its currency (e.g. United States – USD, India – INR, United Kingdom – GBP, Germany – EUR, Canada – CAD, Australia – AUD). All supported currencies use two decimal places. | Currencies with no minor unit (e.g. JPY) would need per-currency rounding.                         |
| A5  | The organisation has ~10,000 employees and is not expected to grow by an order of magnitude soon.                                                                                                                                       | Much larger volumes would raise the bar on list, insight and payroll performance.                  |
| A6  | The tool serves a single organisation.                                                                                                                                                                                                  | Multiple organisations would need data separation.                                                 |
| A7  | Payroll runs **once per calendar month**, and every active employee is paid for the full month (no proration for mid-month joiners or leavers).                                                                                         | Proration would add date-based rules to the calculation.                                           |
| A8  | Deductions such as tax are modelled as **simple rules defined in the salary structure** (a percentage or a fixed amount). Real country-specific tax law is not modelled.                                                                | Real tax compliance would require a dedicated tax engine per country.                              |
| A9  | "Disbursement" means the tool **records** that a month's pay was paid (date and status). It does not move money or connect to a bank.                                                                                                   | Real payments would require banking integration.                                                   |
| A10 | Employee names are not unique. Every employee is identified by a unique, system-assigned **Employee ID**, which is also their login ID.                                                                                                 | —                                                                                                  |
| A11 | Salary structures are **predefined per country** (provided with the system). HR assigns them to employees but does not create or edit them in this version.                                                                             | Editable structures would need versioning so past payslips stay correct.                           |

---

## 3. Goals & Non-Goals

### Goals

- **G1 — Reliable records:** HR can create, view, update and deactivate employee records, and invalid data is rejected at entry.
- **G2 — Clear monthly salary:** Every employee's standard monthly salary (gross, deductions, net) is calculated and visible, in their country's currency.
- **G3 — Accurate, automated payroll:** HR can run a month's payroll for all active employees in one action. Every employee's pay is calculated individually by consistent, transparent rules.
- **G4 — Currency correctness:** Amounts are always shown with their currency and are never converted, totalled or averaged across currencies.
- **G5 — Employee self-service:** Employees can securely log in to see their own payslips and payment history without asking HR.
- **G6 — Fast lookup:** Any employee can be found among 10,000 records in a few seconds.
- **G7 — Actionable insights:** Common salary questions by country and job title are answered instantly and correctly.

### Non-Goals (this version)

- Currency conversion, exchange rates or organisation-wide totals in a single currency
- Real country-specific tax computation and statutory filings
- Moving money or integrating with banks
- Creating or editing salary structures through the tool
- Proration for partial months
- Corrections to a finalised payroll (adjustments go into the next month)
- Approval workflows (e.g. finance sign-off on payroll)
- Multiple organisations / tenants
- Single sign-on, email-based password recovery or two-factor authentication
- Integration with external HR systems

---

## 4. Personas

### Priya — HR Manager (primary)

| Aspect          | Description                                                                                                                                                                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role            | Owns employee records, compensation and monthly payroll for the whole organisation, across all countries.                                                                                                                                                                                                                              |
| Goals           | Keep records accurate; run payroll on time with zero calculation errors; answer leadership's compensation questions quickly.                                                                                                                                                                                                           |
| Jobs-to-be-done | _"When a new hire joins, I want to record them and immediately see what their monthly salary will be."_ · _"At month end, I want to enter overtime and bonuses and get everyone's pay calculated correctly in one go."_ · _"When leadership asks about pay in a country, I want the numbers immediately, in that country's currency."_ |
| Pain points     | Manual payroll formulas, mixed-up currencies, no validation, slow searching, constant payslip requests from employees.                                                                                                                                                                                                                 |
| Frequency       | Daily for records; monthly payroll cycle; weekly-to-monthly for insights.                                                                                                                                                                                                                                                              |
| Tech comfort    | Comfortable with business software; not technical.                                                                                                                                                                                                                                                                                     |

### Arjun — Employee (secondary)

| Aspect          | Description                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role            | One of ~10,000 employees.                                                                                                                                            |
| Goals           | See what they were paid and why; get a payslip for a loan or visa application; check whether this month's pay has been disbursed.                                    |
| Jobs-to-be-done | _"When my pay arrives, I want to see the breakdown so I can understand my deductions."_ · _"When I need proof of income, I want past payslips without emailing HR."_ |
| Pain points     | Waiting on HR for documents; no visibility into how pay is calculated.                                                                                               |
| Frequency       | Monthly, around payday; occasionally for past records.                                                                                                               |
| Tech comfort    | Varies widely — the experience must be simple.                                                                                                                       |

---

## 5. Functional Requirements & User Stories

Each requirement has an ID for traceability through design, implementation, tests and commits.

### 5.1 Access & Accounts

**FR-AUTH-01 — Log in with Employee ID and password** · _Must_

> As a user (HR or Employee), I want to log in with my ID and password, so that only I can access my information.

- **Given** valid credentials, **when** I log in, **then** I land on the home view for my role (HR → Employees; Employee → My Payslips).
- **Given** invalid credentials, **then** I see a generic "Invalid ID or password" message that does not reveal which part was wrong.
- **Given** a deactivated employee's credentials, **then** login is refused.

**FR-AUTH-02 — Role-based access** · _Must_

> As the organisation, we want each role to see only what it is allowed to, so that salary data stays confidential.

- **Given** I am an Employee, **then** I can see only my own profile, payslips and disbursements — never another employee's data, the employee list, payroll runs or insights, even if I try to reach them directly.
- **Given** I am not logged in, **then** I cannot see any data and am directed to log in.

**FR-AUTH-03 — Log out** · _Must_

- **Given** I am logged in, **when** I log out, **then** my session ends and returning requires logging in again.
- **Given** I am inactive for a set period, **then** I am logged out automatically.

**FR-AUTH-04 — Initial password set-up** · _Must_

> As an HR Manager, I want each new employee to receive login credentials, so that they can access self-service from day one.

- **Given** HR creates an employee, **then** the employee receives a system-assigned Employee ID and HR is shown a one-time temporary password to hand over.
- **Given** an employee logs in with a temporary password, **then** they must set a new password before doing anything else.

**FR-AUTH-05 — Change password** · _Should_

- **Given** I am logged in, **when** I enter my current password and a new one meeting the password rules, **then** my password is changed.
- **Password rules:** at least 8 characters, containing letters and numbers; must differ from the current password.

**FR-AUTH-06 — HR resets a forgotten password** · _Should_

- **Given** an employee forgot their password, **when** HR resets it, **then** a new one-time temporary password is generated and FR-AUTH-04's forced change applies.

**FR-AUTH-07 — Lock account after repeated failures** · _Could_

- **Given** 5 consecutive failed login attempts, **then** the account is temporarily locked.

### 5.2 Countries & Currencies

**FR-CUR-01 — Currency is determined by country** · _Must_

> As an HR Manager, I want each employee's pay to be in their country's currency automatically, so that I never record or compare pay in the wrong currency.

- **Given** I choose an employee's country, **then** their currency is set automatically from that country and cannot be chosen separately.
- **Given** any amount is shown anywhere (list, details, payroll, payslips, insights), **then** it is displayed with its currency (e.g. `INR 1,25,000.00` or `USD 5,000.00`), formatted the way that country normally writes amounts.
- **Given** amounts in different currencies, **then** the system never converts them, adds them together or averages them together.

### 5.3 Employee Records (HR)

**FR-EMP-01 — Add an employee** · _Must_

> As an HR Manager, I want to add a new employee with their full name, job title, country, annual base salary and salary structure, so that they are included in records and payroll.

- **Given** I choose a country, **then** the salary is entered in that country's currency and only that country's salary structures are offered.
- **Given** I submit a complete and valid form, **then** the employee is saved with a unique Employee ID, credentials are created (FR-AUTH-04), and I see a confirmation.

**FR-EMP-02 — View employee details** · _Must_

- **Given** an employee exists, **when** I open their record, **then** I see their Employee ID, full name, job title, country, currency, annual base salary, salary structure, status (active / inactive) and standard monthly salary breakdown (FR-EMP-06).
- **Given** the employee does not exist, **then** I see a clear "not found" message.

**FR-EMP-03 — Edit an employee** · _Must_

- **Given** an existing employee, **when** I save valid changes, **then** they are reflected in the list, details, standard monthly salary, insights and **future** payroll runs.
- **Given** I change the employee's country, **then** I must re-enter the annual base salary in the new country's currency and choose a salary structure for the new country. The old amount is never converted automatically.
- **Given** past payslips exist, **then** they remain exactly as issued, in their original currency (see FR-PAY-05).
- **Given** I cancel, **then** no changes are saved.

**FR-EMP-04 — Deactivate an employee** · _Must_

> As an HR Manager, I want to deactivate an employee who has left, so that they stop being paid and lose access, while their payroll history is preserved.

- **Given** I choose to deactivate, **then** I am asked to confirm first.
- **Given** I confirm, **then** the employee is excluded from future payroll runs and from insights, can no longer log in, and their past payslips and disbursements are kept.
- **Given** I decline, **then** nothing changes.

**FR-EMP-05 — Validate employee data** · _Must_

| Field              | Rule                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Full name          | Required; leading/trailing spaces ignored; not blank; reasonable maximum length.                  |
| Job title          | Required; not blank.                                                                              |
| Country            | Required; must be one of the supported countries (A4).                                            |
| Annual base salary | Required; a number greater than zero, in the country's currency, with at most two decimal places. |
| Salary structure   | Required; must be a predefined structure **for the employee's country**.                          |

- **Given** any rule is violated, **then** nothing is saved and a message next to each invalid field explains how to fix it.
- **Given** two employees share a name, **then** both can be saved (A10).

**FR-EMP-06 — Standard monthly salary for every employee** · _Must_

> As an HR Manager, I want to see each employee's calculated monthly salary, so that I know what they are normally paid each month without running payroll.

- **Given** an employee with a base salary and salary structure, **then** the system calculates their **standard monthly salary**: the full breakdown of monthly base, earnings components, gross pay, each deduction and net take-home pay, using the rules in §5.7 with **no overtime, no bonus and 100% variable pay achievement**.
- **Given** I view an employee's details, **then** I see this breakdown in their currency.
- **Given** I am adding or editing an employee, **when** I change the salary, country or structure, **then** the standard monthly salary preview updates immediately, before I save.
- **Given** I browse the employee list, **then** each row shows the employee's standard monthly gross and net pay.
- The standard monthly salary is always recalculated from current data, so it can never be out of date.

### 5.4 Finding Employees (HR)

**FR-FIND-01 — Browse the employee list** · _Must_

- **Given** 10,000 employees exist, **when** I open the list, **then** I see one page of employees (Employee ID, name, job title, country, annual base salary, standard monthly gross and net — each with its currency — and status), the total count and paging controls.

**FR-FIND-02 — Search by name or Employee ID** · _Must_

- **Given** I type part of a name or an Employee ID, **then** only matching employees are shown (case-insensitive, partial match for names).
- **Given** nothing matches, **then** I see "No employees found".

**FR-FIND-03 — Filter by country, job title and status** · _Should_

- **Given** I choose filters, **then** only employees matching all of them are shown, combined with any search.

**FR-FIND-04 — Sort the list** · _Should_

- **Given** I choose to sort by name, **then** the whole list — not just the current page — is ordered accordingly.
- **Given** the list is filtered to a single country, **then** I can also sort by salary.
- **Given** the list shows more than one country, **then** sorting by salary is unavailable, with a short explanation that amounts in different currencies cannot be compared.

### 5.5 Salary Structures

**FR-STR-01 — Predefined, country-specific salary structures** · _Must_

> As an HR Manager, I want a set of predefined salary structures for each country to assign to employees, so that pay is calculated consistently for similar roles in the same country.

A salary structure is a named template **belonging to one country**. Any fixed amounts in it are in that country's currency. It defines how monthly pay is built from the annual base salary:

| Part of the structure | How it is defined                                                | Example ("US Standard", USD)                                                   |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Earnings components   | Each is a % of monthly base or a fixed monthly amount            | Housing allowance 40% of base; transport allowance USD 200 fixed               |
| Variable pay target   | % of monthly base, paid according to that month's achievement %  | 10% of base                                                                    |
| Overtime rule         | Standard monthly hours and an overtime multiplier                | 160 hours; 1.5×                                                                |
| Deductions            | Each is a % of monthly base, a % of gross pay, or a fixed amount | Income tax 20% of gross; retirement 5% of base; health insurance USD 100 fixed |

- **Given** the system is set up, **then** every supported country has at least one structure, and at least three different structure styles exist across the system (e.g. Standard, Sales — higher variable pay, Hourly-heavy — more overtime) so differences are visible.

**FR-STR-02 — View salary structures** · _Should_

- **Given** I am HR, **then** I can view each structure's country, currency, components and rules, so I understand what I am assigning.

### 5.6 Monthly Payroll (HR)

**FR-PAY-01 — Enter monthly inputs** · _Must_

> As an HR Manager, I want to record each employee's variable inputs for the month, so that payroll reflects what actually happened.

| Input                      | Default if not entered | Rule                                           |
| -------------------------- | ---------------------- | ---------------------------------------------- |
| Overtime hours             | 0                      | Zero or more; reasonable upper limit per month |
| Bonus amount               | 0                      | Zero or more, in the employee's currency       |
| Variable pay achievement % | 100%                   | 0% – 200%                                      |

- **Given** invalid input, **then** it is rejected with a clear message.

**FR-PAY-02 — Calculate each employee's monthly pay automatically** · _Must_

> As an HR Manager, I want the system to calculate every active employee's pay for the month in one action, so that payroll is fast and error-free.

- **Given** I start a payroll run for a month, **then** the system calculates pay **separately for each active employee**: gross pay, variable pay, bonus, overtime, each deduction and net take-home pay. It uses that employee's own base salary, salary structure, monthly inputs and currency, following the rules in §5.7.
- **Given** an employee has no monthly inputs, **then** their pay equals their standard monthly salary (FR-EMP-06).
- **Given** the run is still in draft, **when** I change inputs or employee details, **then** I can recalculate and see updated results.
- **Given** an employee's deductions would exceed their gross pay (negative net), **then** that employee is flagged for review and the run cannot be finalised until it is resolved.

**FR-PAY-03 — Review payroll summary** · _Must_

- **Given** a calculated run, **then** I see the headcount and totals (gross, deductions, net) **grouped by country, each in that country's currency** — never one combined total across currencies.
- **Given** I open any employee in the run, **then** I see their full breakdown before finalising.

**FR-PAY-04 — Finalise payroll and publish payslips** · _Must_

- **Given** a draft run with no flagged employees, **when** I finalise it (after confirming), **then** the run is locked, a payslip is issued for every included employee, and payslips become visible to employees.
- **Given** a month has already been finalised, **then** another run for that month cannot be created or finalised.

**FR-PAY-05 — Payslips are a permanent record** · _Must_

- **Given** a payslip has been issued, **when** the employee's salary, structure, country, job title or status later changes, **then** the issued payslip is unchanged. It always shows the values and currency used at the time.

**FR-PAY-06 — Record disbursement** · _Must_

> As an HR Manager, I want to mark a finalised month as paid, so that employees can see when their salary was disbursed.

- **Given** a finalised run, **when** I mark it disbursed with a payment date, **then** every payslip in that run shows status "Paid" and the payment date.
- **Given** a run is not finalised, **then** it cannot be marked disbursed.
- **Payroll run status flow:** Draft → Finalised → Disbursed (no going back).

**FR-PAY-07 — Payroll history** · _Should_

- **Given** past runs exist, **then** HR sees a list of all runs by month with status, headcount and per-country totals, and can open any of them.

### 5.7 Monthly Salary Calculation Rules

These rules apply to both the standard monthly salary (FR-EMP-06) and the monthly payroll (FR-PAY-02), so anyone can reproduce the result by hand.

| Step                  | Rule                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Currency              | Every amount is in the employee's country currency. No conversion takes place at any step.                            |
| Monthly base          | Annual base salary ÷ 12                                                                                               |
| Earnings components   | Per structure: % of monthly base, or fixed amount                                                                     |
| Variable pay          | Monthly base × variable target % × achievement % (100% for the standard monthly salary)                               |
| Overtime pay          | (Monthly base ÷ standard monthly hours) × overtime multiplier × overtime hours (0 for the standard monthly salary)    |
| Bonus                 | Amount entered for the month (0 for the standard monthly salary)                                                      |
| **Gross pay**         | Monthly base + earnings components + variable pay + overtime pay + bonus                                              |
| Deductions            | Per structure: % of monthly base, % of gross pay, or fixed amount                                                     |
| **Net take-home pay** | Gross pay − total deductions                                                                                          |
| Rounding              | Each line is rounded to 2 decimal places (half up) before totals are added, so lines always add up exactly to totals. |

**Worked example 1 — payroll month.** "US Standard" structure (USD), annual base USD 60,000, overtime 10 h, bonus USD 1,000, achievement 80%:

| Line                  | Calculation              | Amount (USD) |
| --------------------- | ------------------------ | -----------: |
| Monthly base          | 60,000 ÷ 12              |     5,000.00 |
| Housing allowance     | 40% × 5,000              |     2,000.00 |
| Transport allowance   | fixed                    |       200.00 |
| Variable pay          | 5,000 × 10% × 80%        |       400.00 |
| Overtime              | (5,000 ÷ 160) × 1.5 × 10 |       468.75 |
| Bonus                 | entered                  |     1,000.00 |
| **Gross pay**         |                          | **9,068.75** |
| Income tax            | 20% × 9,068.75           |     1,813.75 |
| Retirement            | 5% × 5,000               |       250.00 |
| Health insurance      | fixed                    |       100.00 |
| **Total deductions**  |                          | **2,163.75** |
| **Net take-home pay** | 9,068.75 − 2,163.75      | **6,905.00** |

**Worked example 2 — standard monthly salary** for the same employee (no overtime, no bonus, 100% achievement):

| Line                  | Calculation        | Amount (USD) |
| --------------------- | ------------------ | -----------: |
| Monthly base          | 60,000 ÷ 12        |     5,000.00 |
| Housing allowance     | 40% × 5,000        |     2,000.00 |
| Transport allowance   | fixed              |       200.00 |
| Variable pay          | 5,000 × 10% × 100% |       500.00 |
| **Gross pay**         |                    | **7,700.00** |
| Income tax            | 20% × 7,700        |     1,540.00 |
| Retirement            | 5% × 5,000         |       250.00 |
| Health insurance      | fixed              |       100.00 |
| **Total deductions**  |                    | **1,890.00** |
| **Net take-home pay** | 7,700 − 1,890      | **5,810.00** |

These examples are the reference cases for automated tests (NFR-09).

### 5.8 Employee Self-Service

**FR-ESS-01 — View my payslips** · _Must_

> As an Employee, I want to see a list of my payslips by month, so that I can find any past payslip quickly.

- **Given** I am logged in, **then** I see my issued payslips, newest first, each with month, gross pay, net pay (with currency) and payment status.
- **Given** payroll for a month is still in draft, **then** that month does not appear.
- **Given** I have no payslips yet (new joiner), **then** I see a friendly explanation instead of an empty list.

**FR-ESS-02 — View payslip details** · _Must_

- **Given** I open a payslip, **then** I see my Employee ID, name, job title, country, currency, month, every earnings line, every deduction line, gross pay, total deductions, net pay and payment status / date — matching the issued record exactly.

**FR-ESS-03 — View my disbursement history** · _Must_

> As an Employee, I want to see a history of past salary payments, so that I can confirm what was paid and when.

- **Given** I am logged in, **then** I see each disbursed month with the net amount paid (with currency) and the payment date, plus any finalised month awaiting payment shown as "Pending".

**FR-ESS-04 — View my profile and standard monthly salary** · _Should_

- **Given** I am logged in, **then** I can see (but not edit) my Employee ID, name, job title, country, currency, salary structure and standard monthly salary breakdown (FR-EMP-06).

**FR-ESS-05 — Download / print a payslip** · _Could_

- **Given** I open a payslip, **then** I can save or print it in a clean, document-like format.

### 5.9 Salary Insights (HR)

All insights are **per country, in that country's currency**. No insight combines amounts from different currencies.

**FR-INS-01 — Salary statistics by country** · _Must_

- **Given** I choose a country with active employees, **then** I see minimum, maximum and average annual base salary in that country's currency, plus headcount.
- **Given** a country has no active employees, **then** I see a clear message instead of zeros.

**FR-INS-02 — Average salary by job title within a country** · _Must_

- **Given** I choose a country, **then** I see each job title present with its average annual base salary (in that country's currency) and headcount; optionally narrowed to one title.

**FR-INS-03 — Organisation-wide overview** · _Should_

- **Given** active employees exist, **then** I see total headcount, and a table with one row per country showing headcount, currency, and minimum / average / maximum salary in that currency.
- There is no organisation-wide salary total or average, because those would mix currencies.

**Insight rules:** insights use **active employees' annual base salary** (not monthly payroll amounts). Averages are arithmetic means shown to two decimal places. Figures always match current records exactly.

### 5.10 Data Bootstrap

**FR-DATA-01 — Seed realistic data** · _Must_

- **Given** an empty system, **when** seeding is run, **then** it creates:
  - the supported countries with their currencies (A4);
  - predefined salary structures for every supported country (FR-STR-01), with fixed amounts realistic for each currency;
  - ~10,000 fictional employees with realistic names, a spread of job titles and countries, and salaries realistic for each country's currency;
  - a few months of finalised and disbursed payroll history, so self-service has data to show;
  - one HR account and a handful of documented demo employee accounts with known passwords, covering more than one country.
- Seeding is repeatable to reset to a known state. All seeded data is fictional.

### 5.11 Experience Quality

**FR-UX-01 — Empty, loading and error states** · _Should_

- Every view communicates clearly when there is no data, when data is loading and when something went wrong, with a way to recover.

**FR-UX-02 — Feedback after actions** · _Should_

- Every create, edit, deactivate, payroll action and password change gives immediate confirmation of success or a clear explanation of failure.

### 5.12 Future Candidates (Could)

| ID         | Requirement                                 |
| ---------- | ------------------------------------------- |
| FR-AUTH-07 | Lock account after repeated failed logins.  |
| FR-ESS-05  | Download / print payslip.                   |
| FR-INS-04  | Median and percentile salaries per country. |
| FR-INS-05  | Visual salary distribution per country.     |
| FR-EXP-01  | Export the employee list or a payroll run.  |

---

## 6. Prioritisation (MoSCoW)

| Priority                 | Requirements                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must**                 | FR-AUTH-01 – 04 · FR-CUR-01 · FR-EMP-01 – 06 · FR-FIND-01 – 02 · FR-STR-01 · FR-PAY-01 – 06 · FR-ESS-01 – 03 · FR-INS-01 – 02 · FR-DATA-01                                                      |
| **Should**               | FR-AUTH-05 – 06 · FR-FIND-03 – 04 · FR-STR-02 · FR-PAY-07 · FR-ESS-04 · FR-INS-03 · FR-UX-01 – 02                                                                                               |
| **Could**                | FR-AUTH-07 · FR-ESS-05 · FR-INS-04 · FR-INS-05 · FR-EXP-01                                                                                                                                      |
| **Won't (this version)** | Currency conversion · Real tax engine · Bank payments · Editable salary structures · Proration · Post-finalisation corrections · Approval workflows · SSO / 2FA / email recovery · Multi-tenant |

**Rationale:** The Must set delivers each persona's core journey end to end. HR maintains records, sees every employee's monthly salary and runs a complete payroll cycle (inputs → calculate → finalise → disburse). Employees log in to see their payslips and payments. Tying currency to country and never converting keeps every figure honest and removes a whole class of errors (and exchange-rate complexity). Payroll is deliberately modelled with **transparent, rule-based calculations and predefined structures**. That keeps it realistic and fully testable without the large, country-specific complexity of real tax law. The aim is a focused, well-built product rather than a broad, shallow one.

---

## 7. Non-Functional Requirements (product terms)

| ID     | Category           | Requirement                                                                                                                                                                                                       |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Performance        | With 10,000 employees, the list (including standard monthly salary), search, payslip views and insights respond fast enough to feel instant (target: under one second).                                           |
| NFR-02 | Performance        | A full month's payroll for 10,000 employees calculates within one minute.                                                                                                                                         |
| NFR-03 | Accuracy           | Monthly salary, payroll and insight figures always equal a manual calculation using the documented rules.                                                                                                         |
| NFR-04 | Currency integrity | Every amount is stored and shown with its currency. No amount is ever converted, and no total or average ever combines different currencies.                                                                      |
| NFR-05 | Data integrity     | No invalid record or input can be saved through any path. A failed action never leaves data half-saved — for example, a payroll run either finalises completely or not at all.                                    |
| NFR-06 | Security           | Passwords are never stored, shown or logged in readable form (except the one-time temporary password shown to HR). Access rules (FR-AUTH-02) are enforced by the system itself, not just hidden in the interface. |
| NFR-07 | Privacy            | Salary and pay data is visible only to HR and to the employee it belongs to. Demo data is entirely fictional.                                                                                                     |
| NFR-08 | Usability          | Each core task is reachable within three steps from the role's home view. Amounts follow each country's familiar formatting.                                                                                      |
| NFR-09 | Accessibility      | All actions work via keyboard; form fields have labels; errors are announced, not shown by colour alone.                                                                                                          |
| NFR-10 | Maintainability    | Behaviour in this PRD is covered by automated tests traceable to requirement IDs, including the worked examples in §5.7.                                                                                          |

---

## 8. Success Metrics

| Metric                                                                        | Target                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------ |
| Time for HR to find a specific employee                                       | < 5 seconds                                |
| Time for HR to add a new employee                                             | < 30 seconds                               |
| Time from starting a payroll run to a finalised month (excluding input entry) | < 5 minutes                                |
| Salary / payroll calculation errors                                           | 0 (all results match the documented rules) |
| Amounts shown without a currency, or combined across currencies               | 0                                          |
| Employee time to find a specific past payslip                                 | < 10 seconds                               |
| Employees able to see another employee's data                                 | 0                                          |
| Must-have requirements covered by automated tests                             | 100%                                       |

---

## 9. UX Outline

**Shared**

- **Login** — Employee ID and password; forced password change on first login.

**HR views**

1. **Employees (HR home)** — paged table with search, filters and sorting (salary sort only when one country is selected). Each row shows base salary and standard monthly gross / net with currency. Actions to add, view, edit and deactivate; reset password from the employee's details.
2. **Employee form / details** — add or edit with inline validation. Choosing a country sets the currency and limits the structure choices. A live standard monthly salary preview updates as values change. Details show the full monthly breakdown.
3. **Payroll** — list of monthly runs with status and per-country totals. A run view shows the input entry, per-country summary totals, flagged employees and per-employee breakdowns, plus actions to Calculate → Finalise → Mark disbursed.
4. **Salary structures** — read-only view of each country's predefined structures.
5. **Insights** — choose a country to see its statistics and average salary by job title in its currency; an overview table compares countries side by side without combining currencies.

**Employee views**

1. **My Payslips (Employee home)** — list of issued payslips by month with status.
2. **Payslip detail** — full breakdown of earnings, deductions and net pay, in the employee's currency.
3. **Disbursements** — payment history with dates and amounts.
4. **My Profile** — read-only details, standard monthly salary and change password.

**Key flows**

- _Onboard:_ Employees → Add → choose country (currency set) → enter salary and structure → check monthly salary preview → save → hand the temporary password to the employee → the employee logs in and sets a new password.
- _Monthly payroll:_ Payroll → New run for month → enter overtime / bonus / achievement → Calculate → review per-country totals and flags → Finalise → (on payday) Mark disbursed.
- _Employee checks pay:_ Log in → My Payslips → open month → see breakdown and payment status.
- _Relocation:_ Employees → edit → change country → re-enter salary in the new currency and pick a new structure → save.
- _Offboard:_ Employees → search → Deactivate → confirm.

---

## 10. Risks & Open Questions

| ID  | Question / Risk                                                                     | Current position                                                                                                                       |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Which countries and currencies must be supported?                                   | A defined list of two-decimal currencies (A4). Adding a country means adding its currency and salary structures.                       |
| Q2  | Should "average" be mean or median?                                                 | Mean; median is a Could (FR-INS-04).                                                                                                   |
| Q3  | How should mistakes in a finalised payroll be corrected?                            | No edits after finalising; adjustments (e.g. a bonus or deduction) go into the next month. A formal correction process is future work. |
| Q4  | Inconsistent job titles ("Sr. Engineer" vs "Senior Engineer") would split insights. | Suggest existing titles during entry; full standardisation is future work.                                                             |
| Q5  | Upper limits for salary, overtime hours and bonus to catch typos?                   | Needs HR input; sensible per-currency defaults until then.                                                                             |
| Q6  | Should achievement % default to 100% when HR enters nothing?                        | Yes (FR-PAY-01). Confirm with HR.                                                                                                      |
| Q7  | Mid-month joiners and leavers.                                                      | Paid for the full month (A7); proration is future work.                                                                                |
| Q8  | An employee relocating mid-month.                                                   | A country change takes effect from the next payroll run that is not yet finalised; no split-month pay.                                 |
| R1  | Handing over temporary passwords is a manual step and a potential leak.             | Forced change on first login (FR-AUTH-04) limits exposure; email delivery is future work.                                              |
| R2  | Simplified tax rules could be mistaken for real tax compliance.                     | Payslips and documentation state clearly that deductions follow configured rules, not statutory tax law (A8).                          |
| R3  | Changing a structure's rules would silently alter historical pay.                   | Structures are predefined and fixed (A11); issued payslips are permanent (FR-PAY-05).                                                  |
| R4  | Leadership may want an organisation-wide salary total.                              | Deliberately not provided, because it would need currency conversion (a Won't). Per-country totals are shown instead.                  |

---

## 11. Release Scope

| Release                   | Contents                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP (this submission)** | All **Must** and **Should** requirements; NFR-01 – NFR-10.                                                                                                                                                                                |
| **Next**                  | Could items: account lockout, payslip download, median / percentiles, distribution views, export.                                                                                                                                         |
| **Later**                 | Editable and versioned salary structures, proration, payroll corrections, approval workflow, email-based password recovery, currencies without two decimal places, optional reporting-currency views, real tax engines, bank integration. |

---

## Appendix A — Glossary

| Term                    | Meaning                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Employee ID             | Unique, system-assigned identifier for an employee; also their login ID.                                           |
| Supported country       | A country the tool can pay employees in, with exactly one currency.                                                |
| Currency                | The currency of the employee's country. All of an employee's amounts are in it and are never converted.            |
| Annual base salary      | The employee's yearly base pay in their currency, from which monthly pay is derived.                               |
| Salary structure        | A predefined, country-specific template of earnings components, variable pay target, overtime rule and deductions. |
| Standard monthly salary | An employee's calculated monthly pay with no overtime, no bonus and 100% variable pay achievement.                 |
| Monthly inputs          | Per-employee values entered for a month: overtime hours, bonus, variable pay achievement %.                        |
| Gross pay               | Total monthly earnings before deductions.                                                                          |
| Deductions              | Amounts subtracted from gross pay (e.g. tax, retirement, insurance) per the structure's rules.                     |
| Net take-home pay       | Gross pay minus total deductions.                                                                                  |
| Payroll run             | The monthly process of calculating, finalising and disbursing pay for all active employees.                        |
| Payslip                 | The permanent record of one employee's pay for one month.                                                          |
| Disbursement            | The recorded fact that a month's pay was paid, with its payment date.                                              |
| Active / inactive       | Whether an employee is currently employed; inactive employees are not paid and cannot log in.                      |
| Headcount               | Number of employees in a grouping.                                                                                 |
| Seed data               | Fictional data generated to populate the tool for demonstration and testing.                                       |
| MoSCoW                  | Prioritisation scheme: Must, Should, Could, Won't.                                                                 |
