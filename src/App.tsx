import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import Schedules from "@/pages/Schedules"
import NewSchedule from "@/pages/NewSchedule"
import Logs from "@/pages/Logs"
import Settings from "@/pages/Settings"
import AutoCancel from "@/pages/AutoCancel"

import TestReservationE2E from "@/pages/TestReservationE2E"
import ExternalReservations from "@/pages/ExternalReservations"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rota pública de login */}
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/schedules/new" element={<NewSchedule />} />
            <Route path="/schedules/:id" element={<NewSchedule />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auto-cancel" element={<AutoCancel />} />
            <Route path="/reservations" element={<ExternalReservations />} />
            <Route path="/test-e2e" element={<TestReservationE2E />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  )
}

export default App
