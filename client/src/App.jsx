import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicOnlyRoute from "./components/PublicOnlyRoute.jsx";
import AppLayout from "./components/AppLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import WeeklyGrid from "./pages/WeeklyGrid.jsx";

const Insights = lazy(() => import("./pages/Insights.jsx"));
const Stats = lazy(() => import("./pages/Stats.jsx"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-slate-500">
          Loading page...
        </div>
      }
    >
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/weekly" element={<WeeklyGrid />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/stats" element={<Stats />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
