import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AssignmentStatus, ContractorStatus, VendorStatus } from "@/api/types";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

const assignmentStyles: Record<AssignmentStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  DRAFT: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  COMPLETED: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  TERMINATED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge className={assignmentStyles[status]}>{status}</Badge>;
}

const contractorStyles: Record<ContractorStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  BENCH: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  INACTIVE: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export function ContractorStatusBadge({ status }: { status: ContractorStatus }) {
  const label = status === "BENCH" ? "ON BENCH" : status;
  return <Badge className={contractorStyles[status]}>{label}</Badge>;
}

const vendorStyles: Record<VendorStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  INACTIVE: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <Badge className={vendorStyles[status]}>{status}</Badge>;
}
