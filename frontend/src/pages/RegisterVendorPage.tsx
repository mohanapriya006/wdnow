import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";

export function RegisterVendorPage() {
  const { registerVendor } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await registerVendor({
        company_name: companyName,
        contact_name: contactName || undefined,
        email,
        phone: phone || undefined,
        address: address || undefined,
        password,
        confirm_password: confirmPassword,
      });
      navigate("/vendor/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
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
            Vendor Self-Registration
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/70">
            Create your vendor enterprise profile, onboard and manage your contingent contractors,
            issue work orders, track assignments, and streamline invoicing.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">✓</span>
              <span>Direct contractor onboarding & credential provisioning</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">✓</span>
              <span>Complete work order and assignment management</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">✓</span>
              <span>Deterministic RBAC & tenant isolation</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/40">© 2026 VNDLY CWM. Built for enterprise workforce programs.</p>
      </div>

      {/* Right registration form */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
              V
            </div>
            <span className="text-lg font-bold tracking-tight text-ink-900">VNDLY CWM</span>
          </div>

          {/* Role switcher tabs */}
          <div className="mb-6 flex rounded-xl bg-ink-200/60 p-1 text-xs font-semibold">
            <Link
              to="/register/contractor"
              className="flex-1 rounded-lg py-2 text-center text-ink-500 hover:text-ink-900 transition"
            >
              Contractor / Talent
            </Link>
            <button
              type="button"
              className="flex-1 rounded-lg bg-white py-2 text-center text-ink-900 shadow-sm transition"
            >
              Vendor / Agency
            </button>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">Register as a Vendor</h2>
          <p className="mt-1 text-sm text-ink-500">
            Set up your staffing company and manage contingent talent.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                type="text"
                required
                placeholder="e.g. Apex Staffing Solutions"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Work Email *</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="vendor@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <Label htmlFor="address">Headquarters / Location</Label>
              <Input
                id="address"
                type="text"
                placeholder="e.g. Austin, TX or Bangalore, IN"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Complete Vendor Registration
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Already registered?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in to your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}