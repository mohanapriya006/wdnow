import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin text-brand-600", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "info" | "warning";
  children: ReactNode;
}) {
  const styles = {
    error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    info: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
    warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  }[variant];

  return <div className={cn("rounded-lg px-4 py-2.5 text-sm", styles)}>{children}</div>;
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 21a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-500">This module is on the roadmap for Phase 2.</p>
    </div>
  );
}
