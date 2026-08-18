import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "VENDOR" ? "/vendor/dashboard" : "/contractor/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  function fillDemo(role: "vendor" | "priya" | "arun") {
    if (role === "vendor") {
      setEmail("vendor@abcstaffing.com");
      setPassword("Vendor@123");
    } else if (role === "priya") {
      setEmail("priya.sharma@example.com");
      setPassword("Contractor@123");
    } else {
      setEmail("arun.kumar@example.com");
      setPassword("Contractor@123");
    }
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-base font-bold backdrop-blur">
            V
          </div>
          <span className="text-lg font-bold tracking-tight">VNDLY CWM</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Contingent Workforce Management,
            <br /> unified for vendors and contractors.
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/70">
            Manage contractor onboarding, assignments, rates, and program
            performance from a single connected platform — the same
            architecture behind enterprise VMS platforms like Workday VNDLY.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              ["Vendor → Contractor", "Direct ownership model"],
              ["Assignment / Work Order", "Central system of record"],
              ["Rate Cards", "Pay & bill rate control"],
            ].map(([title, sub]) => (
              <div key={title} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold">{title}</p>
                <p className="mt-1 text-[11px] text-white/60">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">© 2026 VNDLY CWM. Built for enterprise workforce programs.</p>
      </div>

      {/* Right login panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
              V
            </div>
            <span className="text-lg font-bold tracking-tight text-ink-900">VNDLY CWM</span>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-500">
            Sign in to your Vendor or Contractor workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign in
            </Button>
          </form>

          <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/70 p-3 text-center text-xs text-ink-600">
            <span className="font-medium text-ink-700">New to VNDLY CWM? </span>
            <div className="mt-1 flex items-center justify-center gap-3 text-xs">
              <Link to="/register/contractor" className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
                Register as Contractor
              </Link>
              <span className="text-ink-300">•</span>
              <Link to="/register/vendor" className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
                Register as Vendor
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-ink-200 bg-white p-4">
            <p className="text-xs font-semibold text-ink-700">Demo credentials</p>
            <p className="mt-0.5 text-[11px] text-ink-400">
              One click fills the form — this app has no separate login pages per role.
            </p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => fillDemo("vendor")}
                className="flex w-full items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-left text-xs hover:bg-ink-50"
              >
                <span className="font-medium text-ink-800">ABC Staffing (Vendor)</span>
                <span className="text-ink-400">vendor@abcstaffing.com</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("priya")}
                className="flex w-full items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-left text-xs hover:bg-ink-50"
              >
                <span className="font-medium text-ink-800">Priya Sharma (Contractor, has assignment)</span>
                <span className="text-ink-400">priya.sharma@...</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("arun")}
                className="flex w-full items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-left text-xs hover:bg-ink-50"
              >
                <span className="font-medium text-ink-800">Arun Kumar (Contractor, no assignment)</span>
                <span className="text-ink-400">arun.kumar@...</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
