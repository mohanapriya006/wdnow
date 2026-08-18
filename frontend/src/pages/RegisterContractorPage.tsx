import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getPublicVendors } from "@/api/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";

export function RegisterContractorPage() {
  const { registerContractor } = useAuth();
  const navigate = useNavigate();

  const { data: vendors, isLoading: loadingVendors } = useQuery({
    queryKey: ["public-vendors"],
    queryFn: getPublicVendors,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Set default vendor if available and not selected
  if (vendors && vendors.length > 0 && !vendorId) {
    setVendorId(vendors[0].id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!vendorId) {
      setError("Please select a staffing agency / vendor.");
      return;
    }
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
      await registerContractor({
        name,
        email,
        vendor_id: vendorId,
        password,
        confirm_password: confirmPassword,
        phone: phone || undefined,
        location: location || undefined,
        experience: experience || undefined,
        skills: skills || undefined,
      });
      navigate("/contractor/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-ink-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-base font-bold backdrop-blur">
            V
          </div>
          <span className="text-lg font-bold tracking-tight">VNDLY CWM</span>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            Contractor Talent Pool
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">
            Join as an Independent Contractor
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/70 leading-relaxed">
            Register your profile to join your agency&apos;s talent bench. Get assigned to premier client
            work orders, track assignments, and view project rates in real time.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
              <span>Automatic placement in your agency&apos;s <strong>Bench Pool</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
              <span>Instant assignment notification and work order transparency</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
              <span>Dedicated contractor portal with role-based access control</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/40">© 2026 VNDLY CWM. Contingent Workforce Management.</p>
      </div>

      {/* Right registration form */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-1/2 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="mb-6 lg:hidden flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
              V
            </div>
            <span className="text-lg font-bold tracking-tight text-ink-900">VNDLY CWM</span>
          </div>

          {/* Role switcher tabs */}
          <div className="mb-6 flex rounded-xl bg-ink-200/60 p-1 text-xs font-semibold">
            <button
              type="button"
              className="flex-1 rounded-lg bg-white py-2 text-center text-ink-900 shadow-sm transition"
            >
              Contractor / Talent
            </button>
            <Link
              to="/register/vendor"
              className="flex-1 rounded-lg py-2 text-center text-ink-500 hover:text-ink-900 transition"
            >
              Vendor / Agency
            </Link>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">Register as a Contractor</h2>
          <p className="mt-1 text-sm text-ink-500">
            Create your account to be placed on bench and ready for project deployment.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                required
                placeholder="e.g. Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <Label htmlFor="vendorId">Representing Staffing Agency / Vendor *</Label>
              {loadingVendors ? (
                <div className="py-2 text-xs text-ink-400">Loading active agencies...</div>
              ) : (
                <select
                  id="vendorId"
                  required
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {vendors && vendors.length > 0 ? (
                    vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.email})
                      </option>
                    ))
                  ) : (
                    <option value="">No active vendors found</option>
                  )}
                </select>
              )}
              <p className="mt-1 text-[11px] text-ink-400">
                You will be added to this agency&apos;s bench pool and they can assign you to projects.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="e.g. Seattle, WA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="experience">Experience</Label>
                <Input
                  id="experience"
                  type="text"
                  placeholder="e.g. 5 years"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="skills">Key Skills</Label>
                <Input
                  id="skills"
                  type="text"
                  placeholder="e.g. React, Node, Python"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                />
              </div>
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

            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800 flex items-start gap-2">
              <span className="text-emerald-600 font-bold mt-0.5">ℹ</span>
              <span>
                Upon registration, your account status will automatically be set to <strong>ON BENCH</strong>.
                Your vendor will see your profile and can assign you to upcoming jobs.
              </span>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Register as Contractor (Bench Pool)
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}