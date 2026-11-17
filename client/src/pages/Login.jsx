import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      await login({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to log in. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to Habit Grove?{" "}
          <Link className="font-semibold text-grove-700 hover:text-grove-900" to="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField label="Email" name="email" type="email" autoComplete="email" />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button-primary w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, footer, children }) {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <section className="auth-panel w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-soft sm:p-9">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grove-600 text-lg font-bold text-white">
              H
            </span>
            <span className="text-lg font-bold text-grove-900">Habit Grove</span>
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mb-7 mt-2 text-sm text-slate-500">{subtitle}</p>
        {children}
        <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
      </section>
    </main>
  );
}

export function FormField({ label, name, type, autoComplete, minLength }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="input-field"
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        required
      />
    </label>
  );
}
