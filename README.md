# Salary Management

A salary and payroll tool for HR teams, with self-service for employees.

**Live demo:** https://salary-mngmt.netlify.app/

- **HR** manage employees, run monthly payroll, view salary structures and salary insights.
- **Employees** see their payslips, payment history and profile.

| Folder      | What it is                                                     |
| ----------- | -------------------------------------------------------------- |
| `backend/`  | REST API: Node.js, Express, Prisma, SQLite                     |
| `frontend/` | Web app: React, Vite, Tailwind CSS, shadcn/ui, TanStack Query  |
| `docs/`     | Product requirements ([PRD.md](docs/PRD.md))                   |

## What you need

- **Node.js 24** (20 or newer works)
- **pnpm 12**. Install it with:

  ```bash
  npm install -g pnpm@12
  ```

## 1. Start the backend

Open a terminal in the project folder:

```bash
cd backend
pnpm install      # install packages
pnpm db:deploy    # create the database (backend/dev.db)
pnpm db:seed      # fill it with demo data (takes about 30 seconds)
pnpm dev          # start the API
```

The API is now running at http://localhost:4000. Leave this terminal open.

No configuration is needed: the defaults work out of the box. To change a setting (port, session timeout, ...), copy
`backend/.env.example` to `backend/.env` and edit it.

## 2. Start the frontend

Open a **second** terminal in the project folder:

```bash
cd frontend
pnpm install      # install packages
pnpm dev          # start the web app
```

Open **http://localhost:5173** in your browser. The web app sends its API calls to the backend on port 4000
automatically.

## 3. Log in

All demo accounts are ready to use, with no password change needed.

| Role     | Login ID   | Password      | Who                                  |
| -------- | ---------- | ------------- | ------------------------------------ |
| HR       | `HR001`    | `HrAdmin123`  | HR Manager                           |
| Employee | `EMP00001` | `Welcome2026` | Emily Carter, United States (USD)    |
| Employee | `EMP00002` | `Welcome2026` | Asha Rao, India (INR)                |
| Employee | `EMP00003` | `Welcome2026` | Oliver Bennett, United Kingdom (GBP) |
| Employee | `EMP00004` | `Welcome2026` | Lena Fischer, Germany (EUR)          |

- **HR** lands on the employee list.
- **Employees** land on their payslips.

## About the demo data

`pnpm db:seed` creates:

- 6 countries, each with its own currency, and salary structures for each country
- 10,000 fictional employees
- 3 months of finalised and paid payroll, so employees have payslips to look at
- the HR and demo employee accounts above

To **reset** everything back to this starting point, stop the backend and run `pnpm db:seed` again in the `backend`
folder. Anything you changed (new employees, payroll runs, passwords) is replaced.

New employees you add as HR get a one-time temporary password, shown once after saving. They must choose their own
password the first time they log in.

## Useful commands

Run these inside the folder shown.

| Folder     | Command          | What it does                     |
| ---------- | ---------------- | -------------------------------- |
| `backend`  | `pnpm dev`       | Start the API (restarts on save) |
| `backend`  | `pnpm db:seed`   | Reset the demo data              |
| `backend`  | `pnpm test`      | Run the backend tests            |
| `backend`  | `pnpm lint`      | Check the code style             |
| `frontend` | `pnpm dev`       | Start the web app                |
| `frontend` | `pnpm build`     | Build the web app for production |
| `frontend` | `pnpm lint`      | Check the code style             |

## Troubleshooting

**The login page says "Cannot reach the server"**
The backend is not running. Start it with `pnpm dev` in the `backend` folder.

**Every backend request fails with "Something went wrong", and the backend log mentions `better_sqlite3.node`**
The SQLite driver was not built during install. Run `pnpm install` again in the `backend` folder.

**"Port 5173 is already in use" or "port 4000 is already in use"**
Another copy is already running. Close the other terminal, or stop the process using that port.
