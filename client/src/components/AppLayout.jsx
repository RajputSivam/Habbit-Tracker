import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const navigation = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/weekly", label: "Weekly grid" },
  { to: "/insights", label: "Insights" },
  { to: "/stats", label: "Stats" },
];

function NavigationLinks({ onNavigate }) {
  return navigation.map(({ to, label }) => (
    <NavLink
      key={to}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `nav-link ${isActive ? "nav-link-active" : "nav-link-idle"}`
      }
    >
      {label}
    </NavLink>
  ));
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell min-h-screen">
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200/80 bg-white px-6 py-7 lg:flex lg:flex-col">
        <NavLink to="/dashboard" className="mb-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grove-600 text-lg font-bold text-white">
            H
          </span>
          <span className="text-lg font-bold tracking-tight text-grove-900">Habit Grove</span>
        </NavLink>
        <nav className="flex flex-col gap-2">
          <NavigationLinks />
        </nav>
        <div className="mt-auto rounded-2xl bg-grove-50 p-4">
          <p className="text-sm font-semibold text-grove-900">Small steps, steady growth.</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Build a routine that works for you.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="app-header sticky top-0 z-10 flex h-16 items-center justify-between border-b border-stone-200/80 bg-white/90 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-grove-600 font-bold text-white">
              H
            </span>
            <span className="font-bold text-grove-900">Habit Grove</span>
          </div>
          <div className="hidden text-sm text-slate-500 lg:block">
            A little progress adds up.
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-slate-600 sm:inline">
              {user?.name || "Your space"}
            </span>
            <button type="button" className="button-quiet" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 pb-28 sm:px-8 lg:py-10 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="app-bottom-nav fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-stone-200 bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Main navigation"
      >
        <NavigationLinks />
      </nav>
    </div>
  );
}
