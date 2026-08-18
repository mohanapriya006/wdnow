import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn, initials } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  comingSoon?: boolean;
}

const iconProps = { className: "h-4.5 w-4.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.75 };

const icons = {
  dashboard: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12l8.25-8.25L20.25 12M4.5 9.75V20.25a.75.75 0 00.75.75H9.5a.75.75 0 00.75-.75v-4.5a.75.75 0 01.75-.75h2.5a.75.75 0 01.75.75v4.5c0 .414.336.75.75.75h4.25a.75.75 0 00.75-.75V9.75" /></svg>
  ),
  profile: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
  ),
  contractors: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
  ),
  assignments: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
  ),
  timesheets: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  milestones: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>
  ),
  invoices: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
  ),
  payroll: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182.553-.44 1.278-.659 2.003-.659.725 0 1.45.22 2.003.659l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  expenses: (
    <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
  ),
};

const vendorNav: NavItem[] = [
  { label: "Dashboard", to: "/vendor/dashboard", icon: icons.dashboard },
  { label: "Contractors", to: "/vendor/contractors", icon: icons.contractors },
  { label: "Projects & Workforce", to: "/vendor/projects", icon: icons.assignments },
  { label: "Assignments", to: "/vendor/assignments", icon: icons.assignments },
  { label: "Timesheets", to: "/vendor/timesheets", icon: icons.timesheets },
  { label: "Milestones", to: "/vendor/milestones", icon: icons.milestones },
  { label: "Invoices", to: "/vendor/invoices", icon: icons.invoices },
  { label: "Payroll", to: "/vendor/payroll", icon: icons.payroll, comingSoon: true },
];

// Milestones are a vendor planning artefact and are intentionally absent here:
// the worker has no milestone route, API access, or navigation entry.
const contractorNav: NavItem[] = [
  { label: "Dashboard", to: "/contractor/dashboard", icon: icons.dashboard },
  { label: "My Assignment", to: "/contractor/assignment", icon: icons.assignments },
  { label: "Timesheets", to: "/contractor/timesheets", icon: icons.timesheets },
  { label: "Invoices", to: "/contractor/invoices", icon: icons.invoices },
  { label: "Expenses", to: "/contractor/expenses", icon: icons.expenses, comingSoon: true },
  { label: "Payroll", to: "/contractor/payroll", icon: icons.payroll, comingSoon: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = user.role === "VENDOR" ? vendorNav : contractorNav;
  const profilePath = user.role === "VENDOR" ? "/vendor/profile" : "/contractor/profile";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-ink-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-ink-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-ink-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            V
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-ink-900">VNDLY CWM</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
              Workforce Platform
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {user.role === "VENDOR" ? "Vendor workspace" : "Contractor workspace"}
          </p>
          {navItems.map((item) =>
            item.comingSoon ? (
              <div
                key={item.to}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-400 cursor-default"
                title="Coming soon"
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  {item.label}
                </span>
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ink-400">
                  Soon
                </span>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="border-t border-ink-100 p-3">
          <NavLink
            to={profilePath}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
              )
            }
          >
            {icons.profile}
            Profile & Settings
          </NavLink>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-ink-200 bg-white px-4 sm:px-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              V
            </div>
            <p className="text-sm font-bold text-ink-900">VNDLY CWM</p>
          </div>
          <div className="hidden md:block" />

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-ink-900">{user.name}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                {user.role}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {initials(user.name)}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
