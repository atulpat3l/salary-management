# Backend architecture

A REST API built with **Express**, **Prisma** and **SQLite**. The diagrams below render on GitHub and in VS Code's
Markdown preview.

## 1. The big picture

```mermaid
flowchart LR
    Browser["Web app<br/>(frontend)"] -- "HTTPS + JSON<br/>Bearer token" --> API["Express API<br/>/api/*"]
    API --> Prisma["Prisma client"]
    Prisma --> DB[("SQLite<br/>dev.db")]
```

One process serves every request. All data lives in a single SQLite file.

## 2. What happens to a request

Every request passes through the same steps, top to bottom.

```mermaid
flowchart TD
    Req(["Incoming request"]) --> Sec["helmet + cors<br/>security headers, allowed origins"]
    Sec --> Body["express.json<br/>parse the JSON body"]
    Body --> Log["requestLogger<br/>log method, path, status, time"]
    Log --> Route{"Which route?"}
    Route -- "/api/auth/login" --> Limit["loginRateLimiter<br/>max attempts per IP"]
    Route -- "any other route" --> Auth["authenticate<br/>valid token + live session?"]
    Auth --> Role["requireRole<br/>HR or EMPLOYEE?"]
    Role --> Validate["Zod schema<br/>check params, query and body"]
    Limit --> Validate
    Validate --> Service["Service<br/>business logic"]
    Service --> DB[("Prisma → SQLite")]
    Service --> Res(["JSON response"])

    Auth -. "401 / 403" .-> Err["errorHandler<br/>{ error: { code, message, fields } }"]
    Role -. "403" .-> Err
    Validate -. "400" .-> Err
    Service -. "404 / 409 / 500" .-> Err
```

Any step can throw. The single `errorHandler` turns every error into the same JSON shape, so the frontend always knows
how to read it.

## 3. How the code is organised

```mermaid
flowchart TD
    Routes["modules/*/ *.routes.ts<br/>URL → handler"] --> Schemas["modules/*/ *.schema.ts<br/>Zod input rules"]
    Routes --> Services["modules/*/ *.service.ts<br/>business logic + database"]
    Services --> Domain["domain/<br/>pay calculator (pure, no database)"]
    Services --> Lib["lib/<br/>money, errors, prisma client, bulk insert"]
    Domain --> Lib
    Middleware["middleware/<br/>auth, roles, rate limit, logging, errors"] --> Routes
    Config["config/env.ts<br/>settings from .env"] --> Lib
```

| Folder         | What it holds                                                                 |
| -------------- | ----------------------------------------------------------------------------- |
| `modules/`     | One folder per feature: `auth`, `employees`, `payroll`, `me`, `insights`, ... |
| `domain/`      | The salary rules. Pure functions, so they are easy to test.                   |
| `middleware/`  | Steps shared by many routes (see diagram 2).                                  |
| `lib/`         | Small helpers: exact money maths, error types, the Prisma client.             |
| `config/`      | Reads and checks environment variables at startup.                            |
| `prisma/`      | Database schema, migrations and the seed script.                              |

### API modules

| Module       | Base path           | Who can use it | What it does                                       |
| ------------ | ------------------- | -------------- | -------------------------------------------------- |
| `auth`       | `/api/auth`         | Everyone       | Log in, log out, current user, change password     |
| `employees`  | `/api/employees`    | HR             | List, add, edit, deactivate, reset password        |
| `structures` | `/api/structures`   | HR             | Salary structures per country                      |
| `countries`  | `/api/countries`    | HR             | Supported countries and their currencies           |
| `payroll`    | `/api/payroll-runs` | HR             | Monthly payroll runs and their payslips            |
| `insights`   | `/api/insights`     | HR             | Salary statistics per country and job title        |
| `me`         | `/api/me`           | Employee       | The logged-in employee's profile and payslips only |

## 4. Logging in and staying logged in

```mermaid
sequenceDiagram
    participant App as Web app
    participant API as Express API
    participant DB as SQLite

    App->>API: POST /api/auth/login (ID + password)
    API->>DB: find account, check password hash
    API->>DB: create a Session row
    API-->>App: token (contains only the session id) + user

    App->>API: GET /api/... with "Authorization: Bearer token"
    API->>DB: load the session and account
    alt session missing, idle too long, or employee deactivated
        API-->>App: 401 → the app shows the login page
    else session is fine
        API-->>App: 200 + data
    end
```

The token only carries a session id. Role and status are read from the database on every request, so logging out,
deactivating an employee or resetting a password takes effect immediately.

## 5. A payroll run's life

```mermaid
stateDiagram-v2
    [*] --> DRAFT: HR creates a run for a month
    DRAFT --> DRAFT: enter inputs / calculate again
    DRAFT --> FINALISED: finalise (no flagged employees)
    FINALISED --> DISBURSED: mark as paid with a payment date
    DISBURSED --> [*]
```

- **Draft:** pay can be recalculated as often as needed. Employees cannot see it yet.
- **Finalised:** payslips are issued and become visible to employees. They never change again.
- **Disbursed:** payslips show as **Paid** with the payment date.

A run only moves forward. Finalising happens in one database transaction, so it either completes fully or changes
nothing.
