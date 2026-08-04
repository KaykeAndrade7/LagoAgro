import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { PropriedadesPage } from './pages/PropriedadesPage'
import { CulturasPage } from './pages/CulturasPage'
import { PlantiosPage } from './pages/PlantiosPage'
import { InsumosPage } from './pages/InsumosPage'
import { AplicacoesPage } from './pages/AplicacoesPage'
import { TarefasPage } from './pages/TarefasPage'
import { ColheitasPage } from './pages/ColheitasPage'
import { TrabalhadoresPage } from './pages/TrabalhadoresPage'
import { FinanceiroPage } from './pages/FinanceiroPage'

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
  {
    path: '/insumos',
    element: (
      <ProtectedRoute>
        <AppShell>
          <InsumosPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/aplicacoes',
    element: (
      <ProtectedRoute>
        <AppShell>
          <AplicacoesPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/tarefas',
    element: (
      <ProtectedRoute>
        <AppShell>
          <TarefasPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/colheitas',
    element: (
      <ProtectedRoute>
        <AppShell>
          <ColheitasPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/trabalhadores',
    element: (
      <ProtectedRoute>
        <AppShell>
          <TrabalhadoresPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/financeiro',
    element: (
      <ProtectedRoute>
        <AppShell>
          <FinanceiroPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
