/**
 * Vendor Invoices.
 *
 * Three views over the same data: work that is ready to bill, the invoice
 * ledger with filters, and the tax configuration that drives the calculation.
 * Generation always goes through a server-priced review step first.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Percent,
  Receipt,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  billableWork,
  generateInvoice,
  invoiceSummary,
  listInvoices,
  listTaxRules,
  previewInvoice,
  saveTaxRules,
  transitionInvoice,
  type InvoiceFilters,
} from "@/api/invoices";
import { listMyContractors } from "@/api/contractors";
import { listProjects } from "@/api/projects";
import type {
  BillableAssignment,
  Invoice,
  InvoicePreview,
  InvoiceStatus,
  InvoiceTaxRule,
  TaxRuleType,
} from "@/api/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { InvoiceStatusBadge } from "@/components/ui/Badge";
import {
  ConfirmDialog,
  InvoiceBreakdown,
  InvoiceTimeline,
  MoneyTile,
  SectionCard,
} from "@/components/invoices/InvoiceParts";
import { extractErrorMessage } from "@/api/client";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Tab = "BILLABLE" | "LEDGER" | "TAX";

const STATUSES: InvoiceStatus[] = [
  "GENERATED", "SUBMITTED", "APPROVED", "PAID", "REJECTED",
];

export function VendorInvoices() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("BILLABLE");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["invoice-summary"],
    queryFn: invoiceSummary,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["invoice-summary"] });
    qc.invalidateQueries({ queryKey: ["invoice-billable"] });
    qc.invalidateQueries({ queryKey: ["invoice-ledger"] });
    qc.invalidateQueries({ queryKey: ["vendor-dashboard"] });
  };

  if (isLoading) return <PageLoader />;
  const cur = summary?.currency ?? "INR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Invoices</h1>
        <p className="mt-1 text-sm text-ink-500">
          Approved weekly hours become invoices here. Amounts, taxes and deductions are calculated
          by the platform from database records.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyTile
          label="Ready to bill"
          value={formatCurrency(summary?.billable_estimated_net ?? 0, cur)}
          sub={`${summary?.billable_hours ?? 0}h across ${summary?.billable_contractors ?? 0} contractor(s)`}
          tone={summary?.billable_contractors ? "brand" : "neutral"}
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
        <MoneyTile
          label="Outstanding"
          value={formatCurrency(summary?.outstanding_total ?? 0, cur)}
          sub={`${(summary?.generated_count ?? 0) + (summary?.submitted_count ?? 0) + (summary?.approved_count ?? 0)} open invoice(s)`}
          tone={summary?.outstanding_total ? "warning" : "neutral"}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <MoneyTile
          label="Paid to date"
          value={formatCurrency(summary?.paid_total ?? 0, cur)}
          sub={`${summary?.paid_count ?? 0} settled`}
          tone="success"
          icon={<Wallet className="h-3.5 w-3.5" />}
        />
        <MoneyTile
          label="Overdue"
          value={summary?.overdue_count ?? 0}
          sub={summary?.overdue_count ? "Past the due date" : "Nothing past due"}
          tone={summary?.overdue_count ? "danger" : "success"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "BILLABLE"} onClick={() => setTab("BILLABLE")}>
          <Sparkles className="h-4 w-4" />
          Ready to bill
          <Count value={summary?.billable_contractors ?? 0} active={tab === "BILLABLE"} />
        </TabButton>
        <TabButton active={tab === "LEDGER"} onClick={() => setTab("LEDGER")}>
          <ClipboardList className="h-4 w-4" />
          Invoice ledger
          <Count value={summary?.total_invoices ?? 0} active={tab === "LEDGER"} />
        </TabButton>
        <TabButton active={tab === "TAX"} onClick={() => setTab("TAX")}>
          <Percent className="h-4 w-4" />
          Tax &amp; deductions
        </TabButton>
      </div>

      {tab === "BILLABLE" && <BillablePanel onDone={refreshAll} />}
      {tab === "LEDGER" && <LedgerPanel onDone={refreshAll} />}
      {tab === "TAX" && <TaxPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-50 text-brand-800"
          : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
      )}
    >
      {children}
    </button>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
        active ? "bg-white/70" : "bg-ink-100"
      )}
    >
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Ready to bill                                                       */
/* ------------------------------------------------------------------ */

function BillablePanel({ onDone }: { onDone: () => void }) {
  const [target, setTarget] = useState<BillableAssignment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice-billable"],
    queryFn: billableWork,
  });

  if (isLoading) return <PageLoader />;
  if (!data?.length) {
    return (
      <Card>
        <EmptyState
          title="Nothing to bill yet"
          description="Approve a contractor's weekly report in Timesheets and their hours will appear here, ready to invoice."
          icon={<Receipt className="h-6 w-6" />}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {data.map((row) => (
          <Card key={row.assignment_id}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{row.contractor_name}</h3>
                <p className="mt-0.5 text-xs text-ink-500">
                  {row.project_name} · {row.role} ·{" "}
                  {formatCurrency(row.hourly_rate, row.currency)}/hr contractual
                  {row.performance_score != null && ` · performance ${row.performance_score}/100`}
                </p>
              </div>
              <Button icon={<FileText className="h-4 w-4" />} onClick={() => setTarget(row)}>
                Review &amp; generate
              </Button>
            </div>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MoneyTile label="Approved hours" value={`${row.total_hours}h`} tone="brand"
                  sub={`${row.weeks.length} week(s) approved`} icon={<Clock className="h-3.5 w-3.5" />} />
                <MoneyTile label="Regular / overtime" value={`${row.regular_hours} / ${row.overtime_hours}`}
                  sub={`${row.weekly_capacity}h configured week`} icon={<TrendingUp className="h-3.5 w-3.5" />} />
                <MoneyTile label="Estimated gross" value={formatCurrency(row.estimated_gross, row.currency)}
                  icon={<Banknote className="h-3.5 w-3.5" />} />
                <MoneyTile label="Estimated net" value={formatCurrency(row.estimated_net, row.currency)}
                  tone="success" sub="After tax and deductions" icon={<Wallet className="h-3.5 w-3.5" />} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
                      <th className="py-2 pr-3 font-semibold">Approved week</th>
                      <th className="py-2 pr-3 text-right font-semibold">Regular</th>
                      <th className="py-2 pr-3 text-right font-semibold">Overtime</th>
                      <th className="py-2 pr-3 text-right font-semibold">Total</th>
                      <th className="py-2 font-semibold">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.weeks.map((w) => (
                      <tr key={w.timesheet_id} className="border-b border-ink-100 last:border-0">
                        <td className="py-2.5 pr-3 text-ink-800">
                          {formatDate(w.week_start)} — {formatDate(w.week_end)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700">{w.regular_hours}h</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700">{w.overtime_hours}h</td>
                        <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-ink-900">{w.total_hours}h</td>
                        <td className="py-2.5">
                          {w.had_anomalies ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Approved with anomalies
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Clean
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {target && (
        <GenerateDialog
          row={target}
          onClose={() => setTarget(null)}
          onGenerated={() => {
            setTarget(null);
            onDone();
          }}
        />
      )}
    </>
  );
}

/** Review step: the server prices the invoice, then the vendor commits it. */
function GenerateDialog({
  row,
  onClose,
  onGenerated,
}: {
  row: BillableAssignment;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [form, setForm] = useState({
    period_start: row.earliest_week ?? "",
    period_end: row.latest_week ?? "",
    adjustment_amount: "",
    adjustment_note: "",
    notes: "",
    due_date: "",
  });

  const payload = {
    assignment_id: row.assignment_id,
    period_start: form.period_start || undefined,
    period_end: form.period_end || undefined,
    adjustment_amount: Number(form.adjustment_amount) || 0,
    adjustment_note: form.adjustment_note || undefined,
  };

  const { data: preview, isLoading, error } = useQuery<InvoicePreview>({
    queryKey: ["invoice-preview", payload],
    queryFn: () => previewInvoice(payload),
  });

  const create = useMutation({
    mutationFn: () =>
      generateInvoice({
        ...payload,
        notes: form.notes || undefined,
        due_date: form.due_date || undefined,
      }),
    onSuccess: onGenerated,
  });

  return (
    <ConfirmDialog
      open
      title={`Generate invoice — ${row.contractor_name}`}
      description="Review the calculation before it becomes a numbered invoice. Nothing is stored until you confirm."
      confirmLabel="Generate invoice"
      busy={create.isPending}
      error={
        create.isError
          ? extractErrorMessage(create.error)
          : error
            ? extractErrorMessage(error)
            : null
      }
      onConfirm={() => create.mutate()}
      onCancel={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Period from</Label>
            <Input type="date" value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
          </div>
          <div>
            <Label>Period to</Label>
            <Input type="date" value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          </div>
          <div>
            <Label>Adjustment ({row.currency})</Label>
            <Input type="number" step="0.01" placeholder="0"
              value={form.adjustment_amount}
              onChange={(e) => setForm({ ...form, adjustment_amount: e.target.value })} />
            <p className="mt-1 text-[11px] text-ink-400">Negative for a penalty or recovery.</p>
          </div>
          <div>
            <Label>Adjustment reason</Label>
            <Input placeholder="Bonus, recovery, correction…" value={form.adjustment_note}
              onChange={(e) => setForm({ ...form, adjustment_note: e.target.value })} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <p className="mt-1 text-[11px] text-ink-400">Defaults to 30 days.</p>
          </div>
          <div>
            <Label>Internal note</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : preview ? (
          <>
            {preview.warnings.length > 0 && (
              <div className="space-y-1.5">
                {preview.warnings.map((w, i) => (
                  <Alert key={i} variant="error">{w}</Alert>
                ))}
              </div>
            )}
            {preview.weeks_billed === 0 ? (
              <Alert variant="error">
                No approved, un-invoiced hours fall inside this period.
              </Alert>
            ) : (
              <>
                <p className="text-xs text-ink-500">
                  {preview.weeks_billed} week(s) · {preview.total_hours}h ·{" "}
                  {formatDate(preview.period_start)} — {formatDate(preview.period_end)}
                </p>
                <InvoiceBreakdown invoice={preview} />
              </>
            )}
          </>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

function LedgerPanel({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [action, setAction] = useState<{ invoice: Invoice; kind: "REJECT" | "MARK_PAID" } | null>(null);
  const [reason, setReason] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoice-ledger", filters],
    queryFn: () => listInvoices(filters),
  });
  const { data: contractors } = useQuery({ queryKey: ["vendor-contractors"], queryFn: listMyContractors });
  const { data: projects } = useQuery({ queryKey: ["vendor-projects"], queryFn: listProjects });

  const move = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Parameters<typeof transitionInvoice>[1]) =>
      transitionInvoice(id, rest),
    onSuccess: () => {
      setAction(null);
      setReason("");
      setPaymentRef("");
      setLocalError(null);
      qc.invalidateQueries({ queryKey: ["invoice-ledger"] });
      onDone();
    },
  });

  const set = (patch: Partial<InvoiceFilters>) => setFilters({ ...filters, ...patch });
  const hasFilters = Object.values(filters).some(Boolean);

  const confirmAction = () => {
    if (!action) return;
    if (action.kind === "REJECT") {
      if (!reason.trim()) {
        setLocalError("A rejection reason is required.");
        return;
      }
      move.mutate({ id: action.invoice.id, action: "REJECT", reason: reason.trim() });
    } else {
      move.mutate({
        id: action.invoice.id,
        action: "MARK_PAID",
        payment_reference: paymentRef.trim() || undefined,
      });
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Filters"
        icon={<Filter className="h-4 w-4 text-brand-600" />}
        actions={
          hasFilters && (
            <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setFilters({})}>
              Clear
            </Button>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input className="pl-9" placeholder="Invoice number or contractor"
                value={filters.q ?? ""} onChange={(e) => set({ q: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Contractor</Label>
            <Select value={filters.contractor_id ?? ""} onChange={(e) => set({ contractor_id: e.target.value })}>
              <option value="">All contractors</option>
              {(contractors ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Project</Label>
            <Select value={filters.project_id ?? ""} onChange={(e) => set({ project_id: e.target.value })}>
              <option value="">All projects</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filters.status ?? ""}
              onChange={(e) => set({ status: (e.target.value || undefined) as InvoiceStatus })}>
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <Label>Invoiced from</Label>
            <Input type="date" value={filters.date_from ?? ""} onChange={(e) => set({ date_from: e.target.value })} />
          </div>
          <div>
            <Label>Invoiced to</Label>
            <Input type="date" value={filters.date_to ?? ""} onChange={(e) => set({ date_to: e.target.value })} />
          </div>
        </div>
      </SectionCard>

      {isLoading ? (
        <PageLoader />
      ) : !invoices?.length ? (
        <Card>
          <EmptyState
            title={hasFilters ? "No invoices match these filters" : "No invoices yet"}
            description={
              hasFilters
                ? "Try widening the date range or clearing the filters."
                : "Generate your first invoice from approved weekly hours."
            }
            icon={<ClipboardList className="h-6 w-6" />}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id} className={cn(inv.is_overdue && "border-red-200")}>
              <button
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
                onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink-900">
                      {inv.invoice_number}
                    </span>
                    <InvoiceStatusBadge status={inv.status} />
                    {inv.is_overdue && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {inv.contractor_name} · {inv.project_name} · {formatDate(inv.period_start)} —{" "}
                    {formatDate(inv.period_end)} · {inv.total_hours}h · due {formatDate(inv.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-base font-bold tabular-nums text-ink-900">
                      {formatCurrency(inv.net_payable, inv.currency)}
                    </p>
                    <p className="text-[11px] text-ink-500">
                      gross {formatCurrency(inv.gross_amount, inv.currency)}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-ink-300 transition-transform",
                      expanded === inv.id && "rotate-90"
                    )}
                  />
                </div>
              </button>

              {expanded === inv.id && (
                <CardContent className="space-y-5 border-t border-ink-100">
                  <InvoiceTimeline invoice={inv} />
                  <InvoiceBreakdown invoice={inv} />

                  {inv.notes && (
                    <p className="text-xs text-ink-500">
                      <span className="font-medium text-ink-700">Note:</span> {inv.notes}
                    </p>
                  )}
                  {inv.status === "PAID" && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Paid {inv.payment_date ? `on ${formatDate(inv.payment_date)}` : ""}
                      {inv.payment_reference ? ` · ref ${inv.payment_reference}` : ""}
                    </div>
                  )}

                  {move.isError && <Alert variant="error">{extractErrorMessage(move.error)}</Alert>}

                  <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                    {inv.status === "GENERATED" && (
                      <Button size="sm" icon={<Send className="h-3.5 w-3.5" />}
                        isLoading={move.isPending}
                        onClick={() => move.mutate({ id: inv.id, action: "SUBMIT" })}>
                        Submit for approval
                      </Button>
                    )}
                    {inv.status === "SUBMITTED" && (
                      <Button size="sm" icon={<BadgeCheck className="h-3.5 w-3.5" />}
                        className="bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
                        isLoading={move.isPending}
                        onClick={() => move.mutate({ id: inv.id, action: "APPROVE" })}>
                        Approve
                      </Button>
                    )}
                    {inv.status === "APPROVED" && (
                      <Button size="sm" icon={<Wallet className="h-3.5 w-3.5" />}
                        className="bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
                        onClick={() => { setAction({ invoice: inv, kind: "MARK_PAID" }); setLocalError(null); }}>
                        Record payment
                      </Button>
                    )}
                    {(inv.status === "GENERATED" || inv.status === "SUBMITTED") && (
                      <Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={() => { setAction({ invoice: inv, kind: "REJECT" }); setReason(""); setLocalError(null); }}>
                        Reject
                      </Button>
                    )}
                  </div>

                  {inv.audit_history.length > 0 && (
                    <details className="text-xs text-ink-500">
                      <summary className="cursor-pointer font-medium">Audit trail</summary>
                      <ul className="mt-2 space-y-1">
                        {inv.audit_history.map((h, i) => <li key={i}>{h}</li>)}
                      </ul>
                    </details>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={action?.kind === "REJECT"}
        title={`Reject ${action?.invoice.invoice_number ?? ""}`}
        description="The billed weeks return to the billable pool so corrected hours can be invoiced again."
        confirmLabel="Reject invoice"
        confirmVariant="danger"
        busy={move.isPending}
        error={localError}
        onConfirm={confirmAction}
        onCancel={() => { setAction(null); setLocalError(null); }}
      >
        <Label>Rejection reason (required)</Label>
        <Textarea rows={3} autoFocus placeholder="Why is this invoice being rejected?"
          value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === "MARK_PAID"}
        title={`Record payment for ${action?.invoice.invoice_number ?? ""}`}
        description={
          action
            ? `Marks ${formatCurrency(action.invoice.net_payable, action.invoice.currency)} as settled.`
            : undefined
        }
        confirmLabel="Mark as paid"
        busy={move.isPending}
        error={localError}
        onConfirm={confirmAction}
        onCancel={() => { setAction(null); setLocalError(null); }}
      >
        <Label>Payment reference (optional)</Label>
        <Input autoFocus placeholder="NEFT / UTR / cheque number"
          value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tax configuration                                                   */
/* ------------------------------------------------------------------ */

type DraftRule = Omit<InvoiceTaxRule, "id"> & { id?: string };

function TaxPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["invoice-tax-rules"], queryFn: listTaxRules });
  const [draft, setDraft] = useState<DraftRule[] | null>(null);
  const [saved, setSaved] = useState(false);

  const rules = draft ?? data ?? [];
  const save = useMutation({
    mutationFn: () =>
      saveTaxRules(
        rules.map(({ code, label, rule_type, rate_percent, is_active, sort_order }) => ({
          code, label, rule_type, rate_percent, is_active, sort_order,
        }))
      ),
    onSuccess: () => {
      setDraft(null);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["invoice-tax-rules"] });
      qc.invalidateQueries({ queryKey: ["invoice-billable"] });
      qc.invalidateQueries({ queryKey: ["invoice-summary"] });
    },
  });

  const patch = (i: number, changes: Partial<DraftRule>) => {
    const next = rules.map((r, n) => (n === i ? { ...r, ...changes } : r));
    setDraft(next);
    setSaved(false);
  };

  if (isLoading) return <PageLoader />;

  return (
    <SectionCard
      title="Tax and deduction configuration"
      icon={<Percent className="h-4 w-4 text-brand-600" />}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline"
            onClick={() => {
              setDraft([
                ...rules,
                { code: "", label: "", rule_type: "TAX" as TaxRuleType, rate_percent: 0, is_active: true, sort_order: rules.length + 1 },
              ]);
              setSaved(false);
            }}>
            + Add rule
          </Button>
          <Button size="sm" isLoading={save.isPending} onClick={() => save.mutate()}>
            Save configuration
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          These rates drive every new invoice. A <b>tax</b> is added to the gross; a{" "}
          <b>deduction</b> is withheld from it. Invoices already generated keep the rates they were
          priced with.
        </p>

        {save.isError && <Alert variant="error">{extractErrorMessage(save.error)}</Alert>}
        {saved && <Alert variant="success">Tax configuration saved.</Alert>}

        {rules.length === 0 ? (
          <EmptyState title="No tax rules configured"
            description="Invoices will bill the gross amount with no tax or deduction applied." />
        ) : (
          <div className="space-y-3">
            {rules.map((rule, i) => (
              <div key={rule.id ?? `new-${i}`}
                className="grid gap-3 rounded-lg border border-ink-200 bg-ink-50/50 p-3 sm:grid-cols-[110px_1fr_140px_120px_auto]">
                <div>
                  <Label>Code</Label>
                  <Input value={rule.code} placeholder="GST"
                    onChange={(e) => patch(i, { code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input value={rule.label} placeholder="GST on services"
                    onChange={(e) => patch(i, { label: e.target.value })} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={rule.rule_type}
                    onChange={(e) => patch(i, { rule_type: e.target.value as TaxRuleType })}>
                    <option value="TAX">Tax (added)</option>
                    <option value="DEDUCTION">Deduction (withheld)</option>
                  </Select>
                </div>
                <div>
                  <Label>Rate %</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={rule.rate_percent}
                    onChange={(e) => patch(i, { rate_percent: Number(e.target.value) })} />
                </div>
                <div className="flex items-end gap-2 pb-0.5">
                  <label className="flex items-center gap-1.5 text-xs text-ink-600">
                    <input type="checkbox" checked={rule.is_active}
                      onChange={(e) => patch(i, { is_active: e.target.checked })} />
                    Active
                  </label>
                  <button type="button" title="Remove rule"
                    className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    onClick={() => { setDraft(rules.filter((_, n) => n !== i)); setSaved(false); }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
