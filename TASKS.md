# Assessment Task List — Salary Management Tool

Tick items off as you go. Requirement IDs refer to [`docs/PRD.md`](docs/PRD.md).

**What the reviewers are looking for:** clear thinking · thoughtful design decisions · clean, maintainable code · meaningful tests · intentional AI use · product thinking. *Good judgment, not complexity.*

---

## 0. Clarify
- [ ] Re-read the original assessment email; confirm the problem statement and the full **Artifacts** list
- [ ] Update PRD §2 Assumptions (and anything affected) where the brief differs
- [ ] Resolve or consciously defer open questions Q1–Q8 and risks R1–R4 (PRD §10)

## 1. Product
- [x] Draft PRD (problem, personas, user stories, acceptance criteria)
- [x] Assign requirement IDs and MoSCoW priorities
- [x] Add payroll, salary structures, login and employee self-service (PRD v0.2)
- [x] Tie currency to country; add standard monthly salary per employee (PRD v0.3)
- [ ] Self-review PRD for clarity and gaps; bump to v1.0

## 2. Design (technical decisions start here)
- [ ] Write design notes: overall architecture, with the *why* and alternatives considered for each key decision
- [ ] Define the data model (countries & currencies, employees, accounts, salary structures, payroll runs, payslips, disbursements)
- [ ] Define the contract between the parts of the app (operations, inputs, outputs, errors)
- [ ] Decide how login, sessions and role-based access are enforced (FR-AUTH-02, NFR-06)
- [ ] Decide how passwords are stored safely (NFR-06)
- [ ] Decide how money and its currency are represented so rounding is exact and currencies can never mix (PRD §5.7, NFR-04)
- [ ] Decide how the standard monthly salary is computed for the list at 10k scale (FR-EMP-06, NFR-01)
- [ ] Make one shared calculation used by both the standard monthly salary and payroll (PRD §5.7)
- [ ] Decide how payslips stay unchanged after later edits (FR-PAY-05)
- [ ] Decide how finalising a run is all-or-nothing (NFR-05)
- [ ] Decide how insights and payroll stay fast at 10k employees (NFR-01, NFR-02)
- [ ] Decide the validation approach so rules are enforced on every path (NFR-05)
- [ ] Decide the testing strategy (what is tested at which level)

## 3. Repository & Process
- [ ] Initialise the Git repository; commit `docs/PRD.md` and `TASKS.md` as the first commit
- [ ] Add a `.gitignore` and a README skeleton
- [ ] Commit in small, meaningful steps (one requirement or concern per commit)
- [ ] Use clear commit messages that reference requirement IDs (e.g. `feat(FR-PAY-02): calculate monthly payroll`)
- [ ] Prefer a test-first rhythm where practical, especially for payroll calculations

## 4. Build

### Must
**Foundation**
- [ ] FR-CUR-01 — Supported countries, each tied to one currency; amounts always shown with currency
- [ ] FR-STR-01 — Predefined salary structures per country
- [ ] FR-DATA-01 — Seed: countries & currencies, structures, 10k employees, payroll history, HR + demo accounts (repeatable)

**Access**
- [ ] FR-AUTH-01 — Log in with Employee ID and password
- [ ] FR-AUTH-02 — Role-based access (employees see only their own data)
- [ ] FR-AUTH-03 — Log out and auto-logout on inactivity
- [ ] FR-AUTH-04 — Temporary password and forced change on first login

**Employee records**
- [ ] FR-EMP-05 — Validation rules
- [ ] FR-EMP-01 — Add employee (Employee ID, credentials; currency from country; structures filtered by country)
- [ ] FR-EMP-02 — View employee details (incl. not-found)
- [ ] FR-EMP-03 — Edit employee (country change requires new salary + structure; past payslips unaffected)
- [ ] FR-EMP-04 — Deactivate employee (with confirmation; history kept)
- [ ] FR-EMP-06 — Standard monthly salary for every employee (details, list, live preview in form)
- [ ] FR-FIND-01 — Paged employee list with total count
- [ ] FR-FIND-02 — Search by name or Employee ID

**Payroll**
- [ ] FR-PAY-01 — Monthly inputs (overtime, bonus, achievement %)
- [ ] FR-PAY-02 — Per-employee automated calculation per PRD §5.7 (incl. negative-net flag)
- [ ] FR-PAY-03 — Payroll summary with totals per country/currency, and per-employee breakdown
- [ ] FR-PAY-04 — Finalise run and publish payslips (one per month)
- [ ] FR-PAY-05 — Payslips are a permanent record
- [ ] FR-PAY-06 — Record disbursement (Draft → Finalised → Disbursed)

**Employee self-service**
- [ ] FR-ESS-01 — My payslips list
- [ ] FR-ESS-02 — Payslip detail
- [ ] FR-ESS-03 — Disbursement history

**Insights**
- [ ] FR-INS-01 — Min / max / average / headcount by country
- [ ] FR-INS-02 — Average salary by job title within a country

### Should
- [ ] FR-AUTH-05 — Change password
- [ ] FR-AUTH-06 — HR resets forgotten password
- [ ] FR-FIND-03 — Filter by country, job title and status
- [ ] FR-FIND-04 — Sort by name; sort by salary only within a single country
- [ ] FR-STR-02 — View salary structures
- [ ] FR-PAY-07 — Payroll history
- [ ] FR-ESS-04 — My profile and standard monthly salary
- [ ] FR-INS-03 — Organisation-wide overview (per-country rows, no cross-currency totals)
- [ ] FR-UX-01 — Empty, loading and error states
- [ ] FR-UX-02 — Feedback after actions

### Could (only if time allows — don't let these dilute quality)
- [ ] FR-AUTH-07 — Account lockout
- [ ] FR-ESS-05 — Download / print payslip
- [ ] FR-INS-04 — Median / percentiles
- [ ] FR-INS-05 — Salary distribution view
- [ ] FR-EXP-01 — Export

## 5. Tests
- [ ] Unit: monthly calculation, using both worked examples in PRD §5.7 as reference cases (payroll month → USD 6,905.00 net; standard monthly → USD 5,810.00 net)
- [ ] Unit: payroll with no monthly inputs equals the standard monthly salary
- [ ] Unit: payroll edge cases (zero overtime/bonus, 0% and 200% achievement, rounding, negative net flagged)
- [ ] Unit: each deduction type (% of base, % of gross, fixed)
- [ ] Unit: validation rules for employees, monthly inputs and passwords
- [ ] Unit: insight calculations against hand-computed values
- [ ] Unit/Integration: currency — set from country; structure must match country; no totals or averages across currencies; amounts formatted per country
- [ ] Integration: login success and failure, generic error message, deactivated user refused
- [ ] Integration: **access control** (an employee cannot reach another employee's payslips or any HR function)
- [ ] Integration: add → view → edit → deactivate flow
- [ ] Integration: payroll lifecycle Draft → Finalised → Disbursed; no second finalised run for a month; draft not visible to employees
- [ ] Integration: editing an employee (incl. country change) after finalising leaves the issued payslip unchanged, in its original currency
- [ ] Integration: country change rejected unless new salary and matching structure are provided
- [ ] Integration: search, filter, sort, paging (salary sort refused across multiple countries)
- [ ] UI tests for key interactions (login, form errors, confirm-before-deactivate, payslip view)
- [ ] Edge cases: empty data, new joiner with no payslips, country with no employees, duplicate names
- [ ] Each test name or description references its requirement ID
- [ ] All tests pass from a clean checkout with a single command

## 6. AI Usage (intentional and documented)
- [ ] Create an AI usage log in the repo (e.g. `docs/AI_USAGE.md`)
- [ ] Record what AI was used for (e.g. PRD drafting, scaffolding, test ideas, seed data)
- [ ] Record what was reviewed, changed or rejected, and why
- [ ] Note key prompts and decisions as you go, not afterwards
- [ ] Verify AI-generated salary/payroll logic against hand calculations; note the result
- [ ] Summarise where AI helped, where it was wrong, and how you checked its output

## 7. Quality Pass
- [ ] Consistent formatting and linting; no warnings
- [ ] Remove dead code, debug output and unused dependencies
- [ ] Clear naming; small focused modules; no duplicated logic
- [ ] Errors handled gracefully with user-friendly messages
- [ ] Security check: no passwords in logs or responses; access rules enforced by the system (NFR-06)
- [ ] Currency check: every amount on every screen shows its currency; nothing mixes currencies (NFR-04)
- [ ] Accessibility check: keyboard, labels, error announcements (NFR-09)
- [ ] Performance check with 10k records and a full payroll run (NFR-01, NFR-02)

## 8. Documentation
- [ ] README: what it is, prerequisites, setup, run, seed, test
- [ ] README: demo login credentials (HR + sample employees)
- [ ] README: key design decisions and trade-offs (link to design notes)
- [ ] README: salary calculation rules summary and the simplifications made (tax, proration, no currency conversion)
- [ ] README: what I'd do next with more time
- [ ] README: links to PRD, design notes and AI usage log
- [ ] Screenshots or a short walkthrough of the HR and employee views (optional, helpful)

## 9. Submission
- [ ] Fresh clone → follow README → app runs, seeds, demo logins work and tests pass
- [ ] All artifacts present (PRD, design notes, code, tests, AI usage log, README)
- [ ] Commit history clearly shows the development process
- [ ] Push to the remote repository; check visibility/access
- [ ] Reply to the same email with the repository link
