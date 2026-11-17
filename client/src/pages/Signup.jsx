import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { AuthShell, FormField } from "./Login.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      await signup({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      });
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to create your account. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start with one small habit and build from there."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-semibold text-grove-700 hover:text-grove-900" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField label="Name" name="name" type="text" autoComplete="name" />
        <FormField label="Email" name="email" type="email" autoComplete="email" />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button-primary w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
