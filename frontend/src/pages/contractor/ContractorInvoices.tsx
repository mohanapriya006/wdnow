/**
 * Worker Invoices.
 *
 * Read-only view of the invoices raised for this worker's approved hours, with
 * the full calculation — hours, contractual rate, taxes, deductions,
 * adjustments and final payable — plus a printable invoice document.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Printer,
  Receipt,
  Wallet,
  XCircle,
} from "lucide-react";
import { myInvoices, myPerformance } from "@/api/invoices";
import type { Invoice } from "@/api/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageLoader } from "@/components/ui/Feedback";
import { InvoiceStatusBadge } from "@/components/ui/Badge";
import {
  InvoiceBreakdown,
  InvoiceTimeline,
  MoneyTile,
  PerformancePanel,
  SectionCard,
} from "@/components/invoices/InvoiceParts";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export function ContractorInvoices() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: myInvoices,
  });
  const { data: performance } = useQuery({
    queryKey: ["my-performance"],
    queryFn: myPerformance,
  });

  const totals = useMemo(() => {
    const list = invoices ?? [];
    const paid = list.filter((i) => i.status === "PAID");
    const open = list.filter((i) => ["GENERATED", "SUBMITTED", "APPROVED"].includes(i.status));
    return {
      currency: list[0]?.currency ?? "INR",
      earned: paid.reduce((n, i) => n + i.net_payable, 0),
      pending: open.reduce((n, i) => n + i.net_payable, 0),
      hours: list.reduce((n, i) => n + i.total_hours, 0),
      count: list.length,
      paidCount: paid.length,
      openCount: open.length,
    };
  }, [invoices]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-ink-900">My invoices</h1>
        <p className="mt-1 text-sm text-ink-500">
          Invoices raised for your approved weekly hours, with the full calculation behind every
          amount.
        </p>
      </div>

      {!invoices?.length ? (
        <Card>
          <EmptyState
            title="No invoices yet"
            description="Once your vendor approves a weekly report and bills it, the invoice appears here."
            icon={<Receipt className="h-6 w-6" />}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
            <MoneyTile label="Paid to you" value={formatCurrency(totals.earned, totals.currency)}
              sub={`${totals.paidCount} settled invoice(s)`} tone="success"
              icon={<Wallet className="h-3.5 w-3.5" />} />
            <MoneyTile label="Awaiting payment" value={formatCurrency(totals.pending, totals.currency)}
              sub={`${totals.openCount} in progress`} tone={totals.openCount ? "warning" : "neutral"}
              icon={<Clock className="h-3.5 w-3.5" />} />
            <MoneyTile label="Hours invoiced" value={`${Math.round(totals.hours * 100) / 100}h`}
              sub={`${totals.count} invoice(s)`} tone="brand"
              icon={<Banknote className="h-3.5 w-3.5" />} />
            <MoneyTile label="Performance score"
              value={performance?.score != null ? `${performance.score}` : "—"}
              sub={performance ? "Analytical KPI only" : "Not enough data yet"}
              tone="brand" icon={<Gauge className="h-3.5 w-3.5" />} />
          </div>

          {performance && (
            <SectionCard
              title="Your performance score"
              icon={<Gauge className="h-4 w-4 text-brand-600" />}
              className="print:hidden"
            >
              <PerformancePanel score={performance} />
            </SectionCard>
          )}

          <div className="space-y-3 print:hidden">
            {invoices.map((inv) => (
              <Card key={inv.id}>
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
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {inv.project_name} · {formatDate(inv.period_start)} —{" "}
                      {formatDate(inv.period_end)} · {inv.total_hours}h ·{" "}
                      {formatCurrency(inv.hourly_rate, inv.currency)}/hr
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-bold tabular-nums text-ink-900">
                        {formatCurrency(inv.net_payable, inv.currency)}
                      </p>
                      <p className="text-[11px] text-ink-500">net payable</p>
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
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <InvoiceTimeline invoice={inv} />
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Printer className="h-3.5 w-3.5" />}
                        onClick={() => {
                          setPrinting(inv);
                          // Let the printable document mount before the dialog.
                          setTimeout(() => window.print(), 60);
                        }}
                      >
                        Print / save as PDF
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <MoneyTile label="Hours worked" value={`${inv.total_hours}h`}
                        sub={`${inv.regular_hours} regular / ${inv.overtime_hours} overtime`} tone="brand" />
                      <MoneyTile label="Contractual rate"
                        value={`${formatCurrency(inv.hourly_rate, inv.currency)}/hr`}
                        sub={`Overtime at ${inv.overtime_multiplier}x`} />
                      <MoneyTile label="Gross earnings"
                        value={formatCurrency(inv.gross_amount, inv.currency)} />
                      <MoneyTile label="Final payable"
                        value={formatCurrency(inv.net_payable, inv.currency)} tone="success" />
                    </div>

                    <InvoiceBreakdown invoice={inv} />

                    {inv.status === "REJECTED" && inv.rejection_reason && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-semibold">This invoice was rejected</p>
                          <p className="mt-0.5 text-xs">{inv.rejection_reason}</p>
                        </div>
                      </div>
                    )}
                    {inv.status === "PAID" && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Paid {inv.payment_date ? `on ${formatDate(inv.payment_date)}` : ""}
                        {inv.payment_reference ? ` · reference ${inv.payment_reference}` : ""}
                      </div>
                    )}

                    <p className="text-[11px] text-ink-400">
                      Invoice dated {formatDate(inv.invoice_date)} · due {formatDate(inv.due_date)} ·
                      raised by {inv.vendor_name}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {printing && <PrintableInvoice invoice={printing} onDone={() => setPrinting(null)} />}
    </div>
  );
}

/**
 * Print-only document. The app has no PDF library, so this uses the browser's
 * own print pipeline — which also produces a PDF via "Save as PDF".
 */
function PrintableInvoice({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-8 print:static print:p-0">
      <style>{`
        @media print {
          body > * { visibility: hidden; }
          .invoice-print, .invoice-print * { visibility: visible; }
          .invoice-print { position: absolute; inset: 0; padding: 24px; }
        }
      `}</style>

      <div className="invoice-print mx-auto max-w-3xl">
        <div className="flex items-start justify-between border-b-2 border-ink-900 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Invoice</h1>
            <p className="mt-1 font-mono text-sm text-ink-600">{invoice.invoice_number}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-ink-900">{invoice.vendor_name}</p>
            <p className="text-ink-600">Invoice date {formatDate(invoice.invoice_date)}</p>
            <p className="text-ink-600">Due {formatDate(invoice.due_date)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Worker</p>
            <p className="mt-1 font-semibold text-ink-900">{invoice.contractor_name}</p>
            <p className="text-ink-600">{invoice.role}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Project &amp; period
            </p>
            <p className="mt-1 font-semibold text-ink-900">{invoice.project_name}</p>
            <p className="text-ink-600">
              {formatDate(invoice.period_start)} — {formatDate(invoice.period_end)}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <InvoiceBreakdown invoice={invoice} />
        </div>

        <p className="mt-6 border-t border-ink-200 pt-3 text-[11px] text-ink-500">
          Status: {invoice.status}
          {invoice.payment_reference ? ` · payment reference ${invoice.payment_reference}` : ""} ·
          {" "}{invoice.weeks_billed} approved weekly report(s) billed at{" "}
          {formatCurrency(invoice.hourly_rate, invoice.currency)}/hour.
        </p>

        <div className="mt-6 flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={onDone}>Close</Button>
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
    </div>
  );
}
