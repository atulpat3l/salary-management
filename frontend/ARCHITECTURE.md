# Frontend architecture

A single-page web app built with **React**, **Vite**, **Tailwind CSS** and **shadcn/ui**. Data comes from the backend
API through **axios** and **TanStack Query** (React Query). The diagrams below render on GitHub and in VS Code's
Markdown preview.

## 1. The big picture

```mermaid
flowchart LR
    User(["HR or employee"]) --> App["React app<br/>in the browser"]
    App -- "/api/* (JSON)" --> Proxy["Vite dev proxy<br/>(only in development)"]
    Proxy --> API["Backend API<br/>localhost:4000"]
```

In development, Vite forwards `/api` calls to the backend on port 4000. In production, set `VITE_API_URL` to the
deployed backend's address when building.

## 2. How a page gets its data

Each layer only talks to the one below it.

```mermaid
flowchart TD
    Pages["pages/<br/>one file per screen"] --> Components["components/<br/>shared pieces + shadcn ui/"]
    Pages --> Hooks["api/<br/>React Query hooks, e.g. useEmployees()"]
    Hooks --> Client["lib/api.ts<br/>axios client"]
    Client --> Backend[("Backend API")]

    Client -. "adds Authorization: Bearer token" .-> Backend
    Client -. "on 401: end the session" .-> Auth["auth/<br/>AuthProvider"]
```

| Folder              | What it holds                                                                  |
| ------------------- | ------------------------------------------------------------------------------ |
| `pages/`            | Screens: `LoginPage`, `pages/hr/*` for HR, `pages/employee/*` for employees    |
| `components/`       | Shared building blocks: layout, pay breakdown table, payslip, empty/error states |
| `components/ui/`    | shadcn/ui components, added with the shadcn CLI (don't edit by hand)           |
| `api/`              | One file per backend resource, each with its React Query hooks                 |
| `auth/`             | Who is logged in, login/logout, and the route guard                            |
| `lib/`              | axios client, API types, money and date formatting                             |
| `hooks/`            | Small reusable React hooks                                                     |
| `router.tsx`        | Every URL and which page it shows                                              |
| `main.tsx`          | Starts the app and wraps it in the providers                                   |

React Query caches every response, shows loading and error states, and refreshes data after a change. For example,
saving an employee refreshes the employee list automatically.

## 3. Pages and who can open them

```mermaid
flowchart TD
    Root["/"] --> Home{"Logged in?"}
    Home -- "no" --> Login["/login"]
    Home -- "HR" --> Employees
    Home -- "employee" --> Payslips

    Login --> Temp{"Temporary password?"}
    Temp -- "yes" --> Change["/change-password"]

    subgraph HR["HR only"]
        Employees["/employees<br/>list, search, filters"]
        EmpDetail["/employees/:id<br/>details, deactivate, reset password"]
        EmpForm["/employees/new<br/>/employees/:id/edit"]
        Payroll["/payroll<br/>/payroll/:id"]
        Structures["/structures"]
        Insights["/insights"]
    end

    subgraph EMP["Employee only"]
        Payslips["/payslips<br/>/payslips/:id"]
        Disbursements["/disbursements"]
        Profile["/profile"]
    end
```

`RequireAuth` guards each group:

- Not logged in → sent to `/login`.
- Still on a temporary password → sent to `/change-password`.
- Wrong role (an employee opening `/employees`) → sent to their own home page.

The backend checks the same rules on every request. Hiding pages is only for convenience, not security.

## 4. Logging in

```mermaid
sequenceDiagram
    participant U as User
    participant P as LoginPage
    participant A as AuthProvider
    participant API as Backend

    U->>P: enters ID + password
    P->>API: POST /api/auth/login
    API-->>P: token + user
    P->>A: signIn(token, user)
    A->>A: save token in localStorage
    P->>U: go to the home page for their role

    Note over A,API: Later, if any request returns 401 (session expired or logged out elsewhere)
    API-->>A: 401
    A->>A: forget the token and all cached data
    A->>U: toast "Your session has ended", show login page
```

## 5. Starting the app

```mermaid
flowchart LR
    Main["main.tsx"] --> QC["QueryClientProvider<br/>data cache"]
    QC --> AP["AuthProvider<br/>current user"]
    AP --> RP["RouterProvider<br/>pages from router.tsx"]
    AP --> Toast["Toaster<br/>success / error messages"]
```
