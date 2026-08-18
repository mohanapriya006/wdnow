import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listInvoices,
  getInvoiceSummary,
  generateInvoice,
  updateInvoiceStatus,
} from "@/api/invoices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PageLoader, Alert, EmptyState } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, InvoiceStatus, InvoiceGeneratePayload } from "@/api/types";

export function VendorInvoices() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form state for generating an invoice
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [formData, setFormData] = useState<InvoiceGeneratePayload>({
    client_name: "Acme Enterprises Inc.",
    client_email: "billing@acme.com",
    client_address: "100 Tech Boulevard, Financial District",
    billing_period_start: startOfMonth,
    billing_period_end: endOfMonth,
    due_date: thirtyDaysLater,
    tax_rate: 18,
    notes: "Payment is due within 30 days of issuance. Please remit via direct wire transfer.",
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["vendor-invoice-summary"],
    queryFn: getInvoiceSummary,
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["vendor-invoices", statusFilter],
    queryFn: () => listInvoices(statusFilter),
  });

  const generateMutation = useMutation({
    mutationFn: generateInvoice,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vendor-invoices"] });
      qc.invalidateQueries({ queryKey: ["vendor-invoice-summary"] });
      setIsGenerateOpen(false);
      setSelectedInvoice(data);
      setActionSuccess(`Invoice ${data.invoice_number} generated successfully!`);
      setTimeout(() => setActionSuccess(null), 5000);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      updateInvoiceStatus(id, status),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vendor-invoices"] });
      qc.invalidateQueries({ queryKey: ["vendor-invoice-summary"] });
      if (selectedInvoice && selectedInvoice.id === data.id) {
        setSelectedInvoice(data);
      }
      setActionSuccess(`Invoice ${data.invoice_number} marked as ${data.status}!`);
      setTimeout(() => setActionSuccess(null), 5000);
    },
  });

  if (loadingSummary || loadingInvoices) return <PageLoader />;

  const currency = summary?.currency || "INR";

  function handleGenerateSubmit(e: React.FormEvent) {
    e.preventDefault();
    generateMutation.mutate(formData);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Client Invoices & Billing</h1>
          <p className="mt-1 text-sm text-ink-500">
            Generate, issue, and track enterprise client billing statements from approved timesheets.
          </p>
        </div>
        <Button onClick={() => setIsGenerateOpen(true)}>
          + Generate Invoice from Timesheets
        </Button>
      </div>

      {actionSuccess && <Alert variant="success">{actionSuccess}</Alert>}
      {generateMutation.isError && (
        <Alert variant="error">{extractErrorMessage(generateMutation.error)}</Alert>
      )}

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Total Invoiced</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {formatCurrency(summary?.total_billed || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-500">{summary?.total_invoices || 0} total invoices</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Outstanding AR</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {formatCurrency(summary?.total_outstanding || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-500">{summary?.issued_count || 0} awaiting payment</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">Total Collected</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {formatCurrency(summary?.total_paid || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">{summary?.paid_count || 0} settled</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Standard GST / Tax</p>
          <p className="mt-1 text-2xl font-bold text-ink-700">18.0%</p>
          <p className="mt-1 text-xs text-ink-500">Auto-applied to line items</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3">
        {[
          { label: "All Invoices", value: "ALL" },
          { label: `Issued / Pending (${summary?.issued_count || 0})`, value: "ISSUED" },
          { label: `Paid (${summary?.paid_count || 0})`, value: "PAID" },
          { label: "Drafts", value: "DRAFT" },
          { label: "Cancelled", value: "CANCELLED" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === tab.value
                ? "bg-brand-700 text-white shadow-sm"
                : "bg-white text-ink-600 hover:bg-ink-100 border border-ink-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {!invoices || invoices.length === 0 ? (
        <EmptyState
          title="No Invoices Found"
          description="Click '+ Generate Invoice from Timesheets' to create a billing invoice from approved contractor hours."
          action={
            <Button onClick={() => setIsGenerateOpen(true)}>Generate First Invoice</Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/70 text-xs font-semibold uppercase tracking-wider text-ink-600">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Invoice #</th>
                <th className="px-3 py-3.5">Client</th>
                <th className="px-3 py-3.5">Billing Period</th>
                <th className="px-3 py-3.5">Due Date</th>
                <th className="px-3 py-3.5 text-right">Amount (incl. Tax)</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-ink-50/50">
                  <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-bold text-ink-900">
                    {inv.invoice_number}
                  </td>
                  <td className="px-3 py-3.5 font-medium text-ink-900">{inv.client_name}</td>
                  <td className="px-3 py-3.5 text-xs text-ink-500">
                    {formatDate(inv.billing_period_start)} – {formatDate(inv.billing_period_end)}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-ink-600">{formatDate(inv.due_date)}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-ink-900">
                    {formatCurrency(inv.total_amount, inv.currency)}
                  </td>
                  <td className="px-3 py-3.5">
                    {inv.status === "PAID" ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                        ✓ Paid
                      </span>
                    ) : inv.status === "ISSUED" ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">
                        ⏳ Issued (Unpaid)
                      </span>
                    ) : inv.status === "CANCELLED" ? (
                      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                        Cancelled
                      </span>
                    ) : (
                      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        View / Print PDF
                      </Button>
                      {inv.status === "ISSUED" && (
                        <Button
                          size="sm"
                          isLoading={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: inv.id, status: "PAID" })}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 my-8">
            <h3 className="text-lg font-bold text-ink-900">Generate Client Invoice</h3>
            <p className="text-xs text-ink-500">
              Aggregates all approved contractor timesheets within the billing window and calculates client billings with tax.
            </p>

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="client_name">Client Company Name *</Label>
                <Input
                  id="client_name"
                  required
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="e.g. Acme Financial Inc."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="client_email">Client Billing Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={formData.client_email || ""}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    placeholder="accounts@client.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tax_rate">Tax / GST Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="client_address">Client Billing Address</Label>
                <Input
                  id="client_address"
                  value={formData.client_address || ""}
                  onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                  placeholder="100 Enterprise Way, Suite 400"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="period_start">Billing Period Start *</Label>
                  <Input
                    id="period_start"
                    type="date"
                    required
                    value={formData.billing_period_start}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_period_start: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="period_end">Billing Period End *</Label>
                  <Input
                    id="period_end"
                    type="date"
                    required
                    value={formData.billing_period_end}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_period_end: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="due_date">Payment Due Date *</Label>
                <Input
                  id="due_date"
                  type="date"
                  required
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="notes">Payment Terms / Bank Remittance Notes</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGenerateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={generateMutation.isPending}>
                  Generate Invoice →
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detailed Print / View Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl space-y-6 my-8 print:shadow-none print:my-0 print:p-6">
            {/* Action buttons (hidden when printing) */}
            <div className="flex items-center justify-between border-b border-ink-100 pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-ink-900">
                  {selectedInvoice.invoice_number}
                </span>
                {selectedInvoice.status === "PAID" ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    ✓ Paid
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    ⏳ Issued
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  🖨️ Print / Save PDF
                </Button>
                {selectedInvoice.status === "ISSUED" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      statusMutation.mutate({ id: selectedInvoice.id, status: "PAID" })
                    }
                  >
                    Mark as Paid
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedInvoice(null)}
                >
                  ✕ Close
                </Button>
              </div>
            </div>

            {/* Printable Invoice Document Body */}
            <div className="space-y-6">
              {/* Header: Company & Invoice Title */}
              <div className="flex justify-between items-start border-b border-ink-200 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-brand-900 tracking-tight">TAX INVOICE</h2>
                  <p className="mt-1 font-semibold text-ink-900">ABC Staffing Solutions</p>
                  <p className="text-xs text-ink-500">GSTIN / Tax ID: 29ABCDE1234F1Z5</p>
                  <p className="text-xs text-ink-500">Bangalore, Karnataka, India</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-ink-900">
                    {selectedInvoice.invoice_number}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    Issue Date: <span className="font-medium text-ink-800">{formatDate(selectedInvoice.issue_date)}</span>
                  </p>
                  <p className="text-xs text-ink-500">
                    Due Date: <span className="font-bold text-rose-700">{formatDate(selectedInvoice.due_date)}</span>
                  </p>
                </div>
              </div>

              {/* Bill To & Billing Period */}
              <div className="grid grid-cols-2 gap-6 rounded-xl bg-ink-50 p-4 text-xs">
                <div>
                  <p className="font-semibold uppercase tracking-wider text-ink-400">Bill To (Client)</p>
                  <p className="mt-1 text-sm font-bold text-ink-900">{selectedInvoice.client_name}</p>
                  {selectedInvoice.client_email && (
                    <p className="text-ink-600">{selectedInvoice.client_email}</p>
                  )}
                  {selectedInvoice.client_address && (
                    <p className="text-ink-600">{selectedInvoice.client_address}</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-ink-400">Billing Cycle</p>
                  <p className="mt-1 text-sm font-medium text-ink-900">
                    {formatDate(selectedInvoice.billing_period_start)} –{" "}
                    {formatDate(selectedInvoice.billing_period_end)}
                  </p>
                  <p className="mt-1 text-ink-500">Payment Terms: Net 30 Days</p>
                </div>
              </div>

              {/* Itemized Line Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-ink-200 bg-ink-100/50 uppercase font-semibold text-ink-600">
                    <tr>
                      <th className="py-2.5 pl-3">Contractor & Project</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3 text-right">Billable Hours</th>
                      <th className="py-2.5 px-3 text-right">Hourly Rate</th>
                      <th className="py-2.5 pr-3 text-right">Line Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {selectedInvoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pl-3 font-semibold text-ink-900">
                          {item.contractor_name}
                          <span className="block text-[11px] font-normal text-ink-500">
                            {item.project_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-ink-700">{item.role}</td>
                        <td className="py-3 px-3 text-right font-medium text-ink-900">
                          {item.hours.toFixed(1)} hrs
                        </td>
                        <td className="py-3 px-3 text-right text-ink-700">
                          {formatCurrency(item.rate, selectedInvoice.currency)}/hr
                        </td>
                        <td className="py-3 pr-3 text-right font-bold text-ink-900">
                          {formatCurrency(item.amount, selectedInvoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Totals */}
              <div className="flex justify-end border-t border-ink-200 pt-4">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-ink-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-ink-900">
                      {formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-ink-600">
                    <span>GST / State Tax ({selectedInvoice.tax_rate}%):</span>
                    <span className="font-semibold text-ink-900">
                      {formatCurrency(selectedInvoice.tax_amount, selectedInvoice.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-ink-300 pt-2 text-sm font-black text-ink-900">
                    <span>Total Amount Due:</span>
                    <span className="text-brand-800">
                      {formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Bank Details */}
              <div className="rounded-xl border border-dashed border-ink-200 p-4 text-xs text-ink-600 space-y-1 bg-ink-50/50">
                <p className="font-semibold text-ink-900">Payment Instructions / Bank Wire:</p>
                <p>Bank: HDFC Bank · A/C: 50200012345678 · IFSC: HDFC0001234</p>
                {selectedInvoice.notes && <p className="italic text-ink-500 mt-1">{selectedInvoice.notes}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
