/**
 * Presentation pieces shared by the vendor and worker invoice screens.
 *
 * Every figure rendered here comes from the API. The invoice calculation engine
 * runs server-side, so nothing in this file recomputes an amount.
 */
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileText,
  Receipt,
  Send,
  XCircle,
} from "lucide-react";
import type {
  Invoice,
  InvoiceLine,
  InvoicePreview,
  InvoiceStatus,
  PerformanceScore,
} from "@/api/types";
import { Card } from "@/components/ui/Card";
import { PerformanceBandBadge } from "@/components/ui/Badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Tiles                                                               */
/* ------------------------------------------------------------------ */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-ink-200 bg-white text-ink-900",
  brand: "border-brand-200 bg-brand-50/60 text-brand-800",
  success: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
  warning: "border-amber-200 bg-amber-50/60 text-amber-800",
  danger: "border-red-200 bg-red-50/60 text-red-800",
};

export function MoneyTile({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", toneClasses[tone])}>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-bold leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] opacity-70">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Financial breakdown                                                 */
/* ------------------------------------------------------------------ */

const lineIcons: Record<string, ReactNode> = {
  REGULAR: <Clock className="h-3.5 w-3.5" />,
  OVERTIME: <AlertTriangle className="h-3.5 w-3.5" />,
  TAX: <Receipt className="h-3.5 w-3.5" />,
  DEDUCTION: <CircleDollarSign className="h-3.5 w-3.5" />,
  ADJUSTMENT: <Calculator className="h-3.5 w-3.5" />,
};

function Row({
  label,
  value,
  strong,
  tone,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "positive" | "negative";
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5",
        strong && "border-t border-ink-200 pt-2.5 mt-1"
      )}
    >
      <span className={cn("text-sm", strong ? "font-semibold text-ink-900" : "text-ink-600")}>
        {label}
        {hint && <span className="ml-1.5 text-[11px] text-ink-400">{hint}</span>}
      </span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-base font-bold text-ink-900" : "text-sm font-medium",
          tone === "positive" && !strong && "text-emerald-700",
          tone === "negative" && !strong && "text-red-700",
          !tone && !strong && "text-ink-800"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The full calculation, from hours to net payable. Accepts either a stored
 * invoice or an unsaved preview - both carry the same money fields.
 */
export function InvoiceBreakdown({
  invoice,
  showLines = true,
}: {
  invoice: Invoice | InvoicePreview;
  showLines?: boolean;
}) {
  const cur = invoice.currency;
  const hourLines = invoice.lines.filter(
    (l) => l.line_type === "REGULAR" || l.line_type === "OVERTIME"
  );
  const chargeLines = invoice.lines.filter(
    (l) => l.line_type !== "REGULAR" && l.line_type !== "OVERTIME"
  );

  return (
    <div className="space-y-5">
      {showLines && hourLines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="py-2 pr-3 font-semibold">Billed work</th>
                <th className="py-2 pr-3 text-right font-semibold">Hours</th>
                <th className="py-2 pr-3 text-right font-semibold">Rate</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {hourLines.map((line) => (
                <tr key={line.id} className="border-b border-ink-100 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1.5 text-ink-800">
                      {lineIcons[line.line_type]}
                      {line.description}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700">
                    {line.quantity}h
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700">
                    {formatCurrency(line.rate, cur)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-ink-900">
                    {formatCurrency(line.amount, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-ink-200 bg-ink-50/50 px-4 py-3">
        <Row
          label="Regular hours"
          hint={`${invoice.regular_hours}h @ ${formatCurrency(invoice.hourly_rate, cur)}`}
          value={formatCurrency(invoice.base_amount, cur)}
        />
        {invoice.overtime_hours > 0 && (
          <Row
            label="Overtime"
            hint={`${invoice.overtime_hours}h @ ${invoice.overtime_multiplier}x`}
            value={formatCurrency(invoice.overtime_amount, cur)}
          />
        )}
        <Row label="Gross amount" value={formatCurrency(invoice.gross_amount, cur)} strong />

        {chargeLines.map((line: InvoiceLine) => (
          <Row
            key={line.id}
            label={line.description}
            value={formatCurrency(line.amount, cur)}
            tone={line.amount < 0 ? "negative" : "positive"}
          />
        ))}
        {chargeLines.length === 0 && (
          <p className="py-1.5 text-xs text-ink-400">No taxes or deductions configured.</p>
        )}

        <Row label="Net payable" value={formatCurrency(invoice.net_payable, cur)} strong />
      </div>

      {invoice.performance_adjusted_amount != null && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-2.5 text-xs text-brand-800">
          <Calculator className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Simulation only: at a performance score of {invoice.performance_score}, a
            performance-linked gross would be{" "}
            <b>{formatCurrency(invoice.performance_adjusted_amount, cur)}</b> instead of{" "}
            {formatCurrency(invoice.gross_amount, cur)}. The contractual rate of{" "}
            {formatCurrency(invoice.hourly_rate, cur)}/hr and the invoiced amount above are
            unchanged.
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lifecycle timeline                                                  */
/* ------------------------------------------------------------------ */

const STEPS: { status: InvoiceStatus; label: string; icon: ReactNode }[] = [
  { status: "GENERATED", label: "Generated", icon: <FileText className="h-3.5 w-3.5" /> },
  { status: "SUBMITTED", label: "Submitted", icon: <Send className="h-3.5 w-3.5" /> },
  { status: "APPROVED", label: "Approved", icon: <BadgeCheck className="h-3.5 w-3.5" /> },
  { status: "PAID", label: "Paid", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

export function InvoiceTimeline({ invoice }: { invoice: Invoice }) {
  if (invoice.status === "REJECTED") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">
            Rejected{invoice.rejected_at ? ` on ${formatDate(invoice.rejected_at.slice(0, 10))}` : ""}
          </p>
          {invoice.rejection_reason && <p className="mt-0.5 text-xs">{invoice.rejection_reason}</p>}
          <p className="mt-1 text-[11px] opacity-80">
            The billed weeks have returned to the billable pool and can be invoiced again.
          </p>
        </div>
      </div>
    );
  }

  const reached = STEPS.findIndex((s) => s.status === invoice.status);
  const stamps: Record<string, string | null> = {
    GENERATED: invoice.generated_at,
    SUBMITTED: invoice.submitted_at,
    APPROVED: invoice.approved_at,
    PAID: invoice.paid_at,
  };

  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {STEPS.map((step, i) => {
        const done = i <= reached;
        return (
          <li key={step.status} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                done
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                  : "bg-ink-100 text-ink-400"
              )}
              title={stamps[step.status] ? formatDate(stamps[step.status]!.slice(0, 10)) : undefined}
            >
              {step.icon}
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={cn("h-px w-4", done ? "bg-emerald-300" : "bg-ink-200")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Worker performance                                                  */
/* ------------------------------------------------------------------ */

export function PerformancePanel({
  score,
  compact = false,
}: {
  score: PerformanceScore;
  compact?: boolean;
}) {
  const scored = score.components.filter((c) => c.value !== null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-brand-200 bg-brand-50">
          <span className="text-2xl font-bold leading-none text-brand-800">
            {score.score ?? "—"}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-brand-600">
            / 100
          </span>
        </div>
        <div className="min-w-0">
          <PerformanceBandBadge band={score.band} />
          <p className="mt-1.5 text-xs text-ink-500">
            Weighted from {score.reports_considered} weekly report
            {score.reports_considered === 1 ? "" : "s"}. Analytical only — it does not change the
            contractual hourly rate.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="space-y-2.5">
          {score.components.map((c) => (
            <div key={c.key}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium text-ink-700">
                  {c.label}
                  {c.value !== null && (
                    <span className="ml-1.5 text-ink-400">
                      {Math.round(c.applied_weight * 100)}% weight
                    </span>
                  )}
                </span>
                <span className="tabular-nums font-semibold text-ink-900">
                  {c.value === null ? "n/a" : `${c.value}`}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    c.value === null
                      ? "bg-ink-200"
                      : c.value >= 70
                        ? "bg-emerald-500"
                        : c.value >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                  )}
                  style={{ width: `${c.value ?? 0}%` }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-ink-400">{c.detail}</p>
            </div>
          ))}
        </div>
      )}

      {!compact && scored.length === 0 && (
        <p className="text-xs text-ink-500">
          No scoring data yet. Submit a weekly report to start building a score.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helper                                                       */
/* ------------------------------------------------------------------ */

export function SectionCard({
  title,
  icon,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
        <div className="flex items-center gap-2 text-ink-900">
          {icon}
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

/** Modal used for irreversible actions (reject, mark paid, generate). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  busy,
  error,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-ink-200 bg-white shadow-xl">
        <div className="border-b border-ink-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
              {error}
            </div>
          )}
          {children}
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-ink-300 bg-white px-4 py-2 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50",
              confirmVariant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-brand-600 hover:bg-brand-700"
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
