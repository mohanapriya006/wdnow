import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getContractorPayrollSummary,
  listContractorPaySlips,
} from "@/api/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PayrollItem } from "@/api/types";

export function ContractorPayroll() {
  const [selectedSlip, setSelectedSlip] = useState<PayrollItem | null>(null);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["contractor-payroll-summary"],
    queryFn: getContractorPayrollSummary,
  });

  const { data: slips, isLoading: loadingSlips } = useQuery({
    queryKey: ["contractor-pay-slips"],
    queryFn: listContractorPaySlips,
  });

  if (loadingSummary || loadingSlips) return <PageLoader />;

  const currency = summary?.currency || "INR";

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My Payroll & Pay Slips</h1>
        <p className="mt-1 text-sm text-ink-500">
          Track your wage disbursements, tax deductions, and download official payment stubs.
        </p>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">Lifetime Earnings</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {formatCurrency(summary?.lifetime_earnings || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">Total net wages deposited</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-800">Pending Next Payout</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {formatCurrency(summary?.pending_payout || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-amber-700 font-medium">Approved hours in current cycle</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Last Disbursed</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {formatCurrency(summary?.last_disbursed_amount || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {summary?.last_disbursed_date ? formatDate(summary.last_disbursed_date) : "No payouts yet"}
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Total Pay Slips</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{summary?.total_paid_slips || 0}</p>
          <p className="mt-1 text-xs text-ink-500">Issued payment receipts</p>
        </div>
      </div>

      {/* Pay Slips Table */}
      <Card>
        <CardHeader>
          <CardTitle>Disbursement History & Pay Stubs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!slips || slips.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No Pay Slips Issued Yet"
                description="Once your vendor executes a payroll run for your approved timesheets, your pay slips will appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-100 bg-ink-50/70 text-xs font-semibold uppercase tracking-wider text-ink-600">
                  <tr>
                    <th className="py-3.5 pl-6 pr-3">Pay Period</th>
                    <th className="px-3 py-3.5">Project & Role</th>
                    <th className="px-3 py-3.5 text-right">Hours Logged</th>
                    <th className="px-3 py-3.5 text-right">Gross Pay</th>
                    <th className="px-3 py-3.5 text-right">TDS (10%)</th>
                    <th className="px-3 py-3.5 text-right font-bold">Net Deposited</th>
                    <th className="px-3 py-3.5">Status</th>
                    <th className="py-3.5 pl-3 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {slips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-ink-50/50">
                      <td className="py-3.5 pl-6 pr-3 font-medium text-ink-900">
                        {formatDate(slip.period_start)} – {formatDate(slip.period_end)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="font-semibold text-ink-900">{slip.project_name}</span>
                        <span className="block text-xs text-ink-500">{slip.role}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold text-ink-800">
                        {slip.total_hours.toFixed(1)} hrs
                      </td>
                      <td className="px-3 py-3.5 text-right text-xs text-ink-600">
                        {formatCurrency(slip.gross_pay, slip.currency)}
                      </td>
                      <td className="px-3 py-3.5 text-right text-xs text-rose-600">
                        -{formatCurrency(slip.tax_withheld, slip.currency)}
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-emerald-700">
                        {formatCurrency(slip.net_payout, slip.currency)}
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
                          onClick={() => setSelectedSlip(slip)}
                        >
                          View Pay Stub →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay Slip Modal & Printable Stub */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl space-y-6 my-8 print:shadow-none print:my-0 print:p-6">
            {/* Header controls (hidden in print) */}
            <div className="flex items-center justify-between border-b border-ink-100 pb-3 print:hidden">
              <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Official Pay Statement
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  🖨️ Print / Save PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedSlip(null)}>
                  ✕ Close
                </Button>
              </div>
            </div>

            {/* Printable Pay Stub Document */}
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-ink-200 pb-4">
                <div>
                  <h2 className="text-xl font-black text-brand-900 tracking-tight">PAY SLIP / WAGE STATEMENT</h2>
                  <p className="text-xs font-semibold text-ink-900 mt-1">ABC Staffing Solutions</p>
                  <p className="text-[11px] text-ink-500">Staffing & Contingent Workforce Services</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                    STATUS: PAID
                  </span>
                  <p className="mt-2 text-xs font-mono text-ink-500">
                    Ref: {selectedSlip.bank_reference || selectedSlip.id}
                  </p>
                </div>
              </div>

              {/* Contractor & Period info */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-ink-50 p-4 text-xs">
                <div>
                  <p className="font-semibold uppercase text-ink-400">Contractor Name</p>
                  <p className="mt-1 text-sm font-bold text-ink-900">{selectedSlip.contractor_name}</p>
                  <p className="text-ink-600 mt-0.5">Role: {selectedSlip.role}</p>
                  <p className="text-ink-600">Project: {selectedSlip.project_name}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase text-ink-400">Pay Period</p>
                  <p className="mt-1 text-sm font-bold text-ink-900">
                    {formatDate(selectedSlip.period_start)} – {formatDate(selectedSlip.period_end)}
                  </p>
                  <p className="text-ink-600 mt-0.5">Pay Rate: {formatCurrency(selectedSlip.pay_rate, selectedSlip.currency)}/hr</p>
                  <p className="text-ink-600">Disbursed via Direct Bank Transfer</p>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-2 gap-4 border border-ink-200 rounded-xl overflow-hidden text-xs">
                {/* Earnings Column */}
                <div className="p-4 space-y-3 bg-white">
                  <p className="font-bold text-ink-900 border-b border-ink-100 pb-1 uppercase tracking-wider">
                    Earnings
                  </p>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Regular Hours ({selectedSlip.regular_hours.toFixed(1)}h):</span>
                    <span className="font-medium text-ink-900">
                      {formatCurrency(selectedSlip.regular_hours * selectedSlip.pay_rate, selectedSlip.currency)}
                    </span>
                  </div>
                  {selectedSlip.overtime_hours > 0 && (
                    <div className="flex justify-between">
                      <span className="text-ink-600">Overtime Hours ({selectedSlip.overtime_hours.toFixed(1)}h):</span>
                      <span className="font-medium text-ink-900">
                        {formatCurrency(selectedSlip.overtime_hours * selectedSlip.pay_rate, selectedSlip.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-ink-100 pt-2 font-bold text-ink-900">
                    <span>Total Gross Pay:</span>
                    <span>{formatCurrency(selectedSlip.gross_pay, selectedSlip.currency)}</span>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="p-4 space-y-3 bg-ink-50/60 border-l border-ink-200">
                  <p className="font-bold text-ink-900 border-b border-ink-200 pb-1 uppercase tracking-wider">
                    Deductions & Taxes
                  </p>
                  <div className="flex justify-between">
                    <span className="text-ink-600">TDS Tax Withholding ({selectedSlip.tax_rate}%):</span>
                    <span className="font-medium text-rose-700">
                      -{formatCurrency(selectedSlip.tax_withheld, selectedSlip.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-ink-200 pt-2 font-bold text-rose-700">
                    <span>Total Deductions:</span>
                    <span>-{formatCurrency(selectedSlip.tax_withheld, selectedSlip.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Net Take Home Payout */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex justify-between items-center text-emerald-900">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Net Take-Home Pay</p>
                  <p className="text-xs text-emerald-700">Deposited to registered contractor bank account</p>
                </div>
                <span className="text-2xl font-black text-emerald-800">
                  {formatCurrency(selectedSlip.net_payout, selectedSlip.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
