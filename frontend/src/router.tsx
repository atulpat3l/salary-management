import { createBrowserRouter } from 'react-router'
import { HomeRedirect } from '@/auth/HomeRedirect'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/AppLayout'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { DisbursementsPage } from '@/pages/employee/DisbursementsPage'
import { MyPayslipPage } from '@/pages/employee/MyPayslipPage'
import { MyPayslipsPage } from '@/pages/employee/MyPayslipsPage'
import { ProfilePage } from '@/pages/employee/ProfilePage'
import { EmployeeDetailPage } from '@/pages/hr/EmployeeDetailPage'
import { EmployeeFormPage } from '@/pages/hr/EmployeeFormPage'
import { EmployeesPage } from '@/pages/hr/EmployeesPage'
import { InsightsPage } from '@/pages/hr/InsightsPage'
import { PayrollRunPage } from '@/pages/hr/PayrollRunPage'
import { PayrollRunsPage } from '@/pages/hr/PayrollRunsPage'
import { StructuresPage } from '@/pages/hr/StructuresPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth allowPendingPasswordChange />,
    children: [{ path: '/change-password', element: <ChangePasswordPage /> }],
  },
  {
    // FR-AUTH-02: HR-only views. The server enforces the same rule on every request.
    element: <RequireAuth role="HR" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/employees', element: <EmployeesPage /> },
          { path: '/employees/new', element: <EmployeeFormPage /> },
          { path: '/employees/:id', element: <EmployeeDetailPage /> },
          { path: '/employees/:id/edit', element: <EmployeeFormPage /> },
          { path: '/payroll', element: <PayrollRunsPage /> },
          { path: '/payroll/:id', element: <PayrollRunPage /> },
          { path: '/structures', element: <StructuresPage /> },
          { path: '/insights', element: <InsightsPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth role="EMPLOYEE" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/payslips', element: <MyPayslipsPage /> },
          { path: '/payslips/:id', element: <MyPayslipPage /> },
          { path: '/disbursements', element: <DisbursementsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
