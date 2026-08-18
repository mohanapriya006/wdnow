import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listVendorPayrollRuns,
  getVendorPayrollSummary,
  executePayrollRun,
} from "@/api/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PageLoader, Alert, EmptyState } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PayrollRun, PayrollRunCreatePayload } from "@/api/types";

export function VendorPayroll() {
  const qc = useQueryClient();
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [formData, setFormData] = useState<PayrollRunCreatePayload>({
    period_start: startOfMonth,
    period_end: endOfMonth,
    tax_rate: 10,
    payment_method: "Direct Bank Transfer",
    notes: "Bi-weekly contractor compensation payout with 10% standard TDS withholding.",
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["vendor-payroll-summary"],
    queryFn: getVendorPayrollSummary,
  });

  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ["vendor-payroll-runs"],
    queryFn: listVendorPayrollRuns,
  });

  const runMutation = useMutation({
    mutationFn: executePayrollRun,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vendor-payroll-runs"] });
      qc.invalidateQueries({ queryKey: ["vendor-payroll-summary"] });
      setIsRunModalOpen(false);
      setSelectedRun(data);
      setActionSuccess(
        `Payroll Run ${data.run_reference} processed successfully! Disbursed to ${data.total_contractors} contractors.`
      );
      setTimeout(() => setActionSuccess(null), 5000);
    },
  });

  if (loadingSummary || loadingRuns) return <PageLoader />;

  const currency = summary?.currency || "INR";

  function handleRunSubmit(e: React.FormEvent) {
    e.preventDefault();
    runMutation.mutate(formData);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Contractor Payroll & Disbursements</h1>
          <p className="mt-1 text-sm text-ink-500">
            Process batch wage disbursements for approved timesheets, calculate TDS withholding, and generate pay slips.
          </p>
        </div>
        <Button onClick={() => setIsRunModalOpen(true)}>
          ⚡ Process Batch Payroll Run
        </Button>
      </div>

      {actionSuccess && <Alert variant="success">{actionSuccess}</Alert>}
      {runMutation.isError && (
        <Alert variant="error">{extractErrorMessage(runMutation.error)}</Alert>
      )}

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Total Disbursed</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {formatCurrency(summary?.total_disbursed || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {summary?.active_contractors_paid || 0} contractors paid to date
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-800">Pending Payouts</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {formatCurrency(summary?.pending_disbursement || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-amber-700 font-medium">Approved hours awaiting pay run</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">TDS / Tax Withheld</p>
          <p className="mt-1 text-2xl font-bold text-ink-700">
            {formatCurrency(summary?.total_tax_withheld || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-500">Total tax deducted at source</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Total Pay Runs</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{summary?.total_runs || 0}</p>
          <p className="mt-1 text-xs text-ink-500">Executed pay cycles</p>
        </div>
      </div>

      {/* Historical Payroll Runs */}
      {!runs || runs.length === 0 ? (
        <EmptyState
          title="No Payroll Runs Executed Yet"
          description="When you have approved contractor timesheets, click 'Process Batch Payroll Run' to disburse contractor wages."
          action={
            <Button onClick={() => setIsRunModalOpen(true)}>Execute First Pay Run</Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/70 text-xs font-semibold uppercase tracking-wider text-ink-600">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Batch Run #</th>
                <th className="px-3 py-3.5">Period</th>
                <th className="px-3 py-3.5">Contractors</th>
                <th className="px-3 py-3.5 text-right">Total Hours</th>
                <th className="px-3 py-3.5 text-right">Gross Pay</th>
                <th className="px-3 py-3.5 text-right">TDS Tax</th>
                <th className="px-3 py-3.5 text-right font-bold">Net Disbursed</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-ink-50/50">
                  <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-bold text-ink-900">
                    {run.run_reference}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-ink-600">
                    {formatDate(run.period_start)} – {formatDate(run.period_end)}
                  </td>
                  <td className="px-3 py-3.5 font-medium text-ink-900">
                    {run.total_contractors} talent
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold text-ink-800">
                    {run.total_hours.toFixed(1)} hrs
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs text-ink-600">
                    {formatCurrency(run.total_gross_pay, run.currency)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs text-rose-600">
                    -{formatCurrency(run.total_tax_withheld, run.currency)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-bold text-emerald-700">
                    {formatCurrency(run.total_net_payout, run.currency)}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                      ✓ Paid
                    </span>
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRun(run)}
                    >
                      View Breakdown →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Process Payroll Modal */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 my-8">
            <h3 className="text-lg font-bold text-ink-900">Process Batch Payroll Run</h3>
            <p className="text-xs text-ink-500">
              Aggregates all unpaid approved timesheets in the date range, applies TDS withholding, and records batch disbursements.
            </p>

            <form onSubmit={handleRunSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="period_start">Pay Period Start *</Label>
                  <Input
                    id="period_start"
                    type="date"
                    required
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="period_end">Pay Period End *</Label>
                  <Input
                    id="period_end"
                    type="date"
                    required
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tax_rate">TDS Withholding Tax (%)</Label>
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
                <div>
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <select
                    id="payment_method"
                    value={formData.payment_method}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_method: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-ink-200 bg-white px-2.5 text-xs text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none"
                  >
                    <option value="Direct Bank Transfer">Direct Bank Transfer / NEFT</option>
                    <option value="UPI Instant Disbursement">UPI Instant Disbursement</option>
                    <option value="Automated ACH / Wire">Automated ACH / Wire</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Disbursement Notes (Optional)</Label>
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
                  onClick={() => setIsRunModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={runMutation.isPending}>
                  Execute Batch Payout →
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payroll Run Detail Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-ink-900">
                  Payroll Batch: <span className="font-mono text-brand-700">{selectedRun.run_reference}</span>
                </h3>
                <p className="text-xs text-ink-500">
                  Period: {formatDate(selectedRun.period_start)} – {formatDate(selectedRun.period_end)} · Method: {selectedRun.payment_method}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedRun(null)}>
                ✕ Close
              </Button>
            </div>

            {/* Run totals header */}
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-ink-50 p-3 text-xs">
              <div>
                <span className="text-ink-400">Total Gross:</span>
                <p className="font-bold text-ink-900 text-sm">
                  {formatCurrency(selectedRun.total_gross_pay, selectedRun.currency)}
                </p>
              </div>
              <div>
                <span className="text-ink-400">TDS Tax Deducted:</span>
                <p className="font-bold text-rose-700 text-sm">
                  -{formatCurrency(selectedRun.total_tax_withheld, selectedRun.currency)}
                </p>
              </div>
              <div>
                <span className="text-ink-400">Net Disbursed:</span>
                <p className="font-bold text-emerald-700 text-sm">
                  {formatCurrency(selectedRun.total_net_payout, selectedRun.currency)}
                </p>
              </div>
            </div>

            {/* Itemized contractor breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-ink-100 bg-ink-100/50 uppercase font-semibold text-ink-600">
                  <tr>
                    <th className="py-2.5 pl-3">Contractor & Project</th>
                    <th className="py-2.5 px-3">Hours</th>
                    <th className="py-2.5 px-3">Pay Rate</th>
                    <th className="py-2.5 px-3">Gross</th>
                    <th className="py-2.5 px-3">Tax (10%)</th>
                    <th className="py-2.5 px-3 font-bold">Net Paid</th>
                    <th className="py-2.5 pr-3">Bank UTR Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {selectedRun.items.map((item) => (
                    <tr key={item.id} className="hover:bg-ink-50/50">
                      <td className="py-2.5 pl-3 font-semibold text-ink-900">
                        {item.contractor_name}
                        <span className="block text-[11px] font-normal text-ink-500">{item.project_name}</span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-ink-800">{item.total_hours.toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-ink-700">{formatCurrency(item.pay_rate, item.currency)}/hr</td>
                      <td className="py-2.5 px-3 text-ink-800">{formatCurrency(item.gross_pay, item.currency)}</td>
                      <td className="py-2.5 px-3 text-rose-600">-{formatCurrency(item.tax_withheld, item.currency)}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        {formatCurrency(item.net_payout, item.currency)}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-ink-500">
                        {item.bank_reference || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
