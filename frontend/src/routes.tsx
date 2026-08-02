import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { PropriedadesPage } from './pages/PropriedadesPage'
import { CulturasPage } from './pages/CulturasPage'
import { PlantiosPage } from './pages/PlantiosPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/propriedades',
    element: (
      <ProtectedRoute>
        <AppShell>
          <PropriedadesPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/culturas',
    element: (
      <ProtectedRoute>
        <AppShell>
          <CulturasPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/plantios',
    element: (
      <ProtectedRoute>
        <AppShell>
          <PlantiosPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
