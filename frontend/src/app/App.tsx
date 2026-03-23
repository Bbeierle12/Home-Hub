import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { AuthPage } from "../pages/auth/AuthPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { CalendarPage } from "../pages/calendar/CalendarPage";
import { FinancePage } from "../pages/finance/FinancePage";
import { PantryPage } from "../pages/pantry/PantryPage";
import { HouseholdPage } from "../pages/household/HouseholdPage";
import { ShoppingPage } from "../pages/shopping/ShoppingPage";
import { TasksPage } from "../pages/tasks/TasksPage";
import { useAuthStore } from "../stores/auth";
import { householdWsClient } from "../ws/client";
import { handleWsMessage } from "../ws/handlers";

export function App() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (!accessToken || !user?.household_id) {
      householdWsClient.disconnect();
      return;
    }

    householdWsClient.connect(accessToken, user.household_id);
    const unsubscribe = householdWsClient.subscribe(handleWsMessage);

    return () => {
      unsubscribe();
      householdWsClient.disconnect();
    };
  }, [accessToken, user?.household_id]);

  if (!isHydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[color:var(--color-muted)]">Loading session...</div>;
  }

  if (!user || !accessToken) {
    return <AuthPage />;
  }

  if (!user.household_id && !user.is_superadmin) {
    return <HouseholdPage />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/shopping" element={<ShoppingPage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/finance" element={<FinancePage />} />
      </Route>
    </Routes>
  );
}
