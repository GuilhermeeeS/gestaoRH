import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '@/pages/dashboard/Layout'
import DashboardOverview from '@/pages/dashboard/Overview'
import HealthStatusPage from '@/pages/dashboard/HealthStatus'
import CoilsMonitorPage from '@/pages/dashboard/CoilsMonitor'
import BRTAEmployeesPage from '@/pages/dashboard/brta/Employees'
import BRGOEmployeesPage from '@/pages/dashboard/brgo/Employees'
import LoginPage from '@/pages/Login'
import { RequireAuth } from '@/components/auth/RequireAuth'
import AdminUsersPage from '@/pages/dashboard/admin/Users'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardOverview />} />
          <Route path="health" element={<HealthStatusPage />} />
          <Route path="coils" element={<CoilsMonitorPage />} />
          <Route path="brta/employees" element={<BRTAEmployeesPage />} />
          <Route path="brgo/employees" element={<BRGOEmployeesPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
