import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAllVendorTimesheets,
  getVendorTimesheetSummary,
  reviewTimesheet,
} from "@/api/timesheets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PageLoader, Alert, EmptyState } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Timesheet } from "@/api/types";

export function VendorTimesheets() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedSheet, setSelectedSheet] = useState<Timesheet | null>(null);
  const [flagComment, setFlagComment] = useState("");
  const [flagEntryId, setFlagEntryId] = useState<string | undefined>(undefined);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch summary KPI stats
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["vendor-timesheet-summary"],
    queryFn: getVendorTimesheetSummary,
  });

  // Fetch timesheets by status filter
  const { data: sheets, isLoading: loadingSheets } = useQuery({
    queryKey: ["vendor-timesheets", statusFilter],
    queryFn: () => listAllVendorTimesheets(statusFilter),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      action,
      comment,
      entryId,
    }: {
      id: string;
      action: "APPROVE" | "FLAG";
      comment?: string;
      entryId?: string;
    }) => reviewTimesheet(id, { action, comment, entry_id: entryId }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vendor-timesheets"] });
      qc.invalidateQueries({ queryKey: ["vendor-timesheet-summary"] });
      setIsFlagModalOpen(false);
      setFlagComment("");
      setFlagEntryId(undefined);
      setSelectedSheet(null);
      setActionSuccess(
        data.status === "APPROVED"
          ? `Timesheet for ${data.contractor_name} approved successfully!`
          : `Revision requested for ${data.contractor_name}'s timesheet.`
      );
      setTimeout(() => setActionSuccess(null), 5000);
    },
  });

  if (loadingSummary || loadingSheets) return <PageLoader />;

  const currency = summary?.currency || "INR";

  function handleApprove(sheet: Timesheet) {
    reviewMutation.mutate({
      id: sheet.id,
      action: "APPROVE",
      comment: "Approved by vendor manager.",
    });
  }

  function handleOpenFlag(sheet: Timesheet, entryId?: string) {
    setSelectedSheet(sheet);
    setFlagEntryId(entryId);
    setFlagComment("");
    setIsFlagModalOpen(true);
  }

  function submitFlag() {
    if (!selectedSheet) return;
    reviewMutation.mutate({
      id: selectedSheet.id,
      action: "FLAG",
      comment: flagComment || "Please review and revise the logged hours.",
      entryId: flagEntryId,
    });
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Timesheets & Approvals</h1>
        <p className="mt-1 text-sm text-ink-500">
          Review, approve, and track contractor billable hours, labor payouts, and profit margins.
        </p>
      </div>

      {actionSuccess && <Alert variant="success">{actionSuccess}</Alert>}
      {reviewMutation.isError && <Alert variant="error">{extractErrorMessage(reviewMutation.error)}</Alert>}

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Pending Review</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{summary?.pending_count || 0}</span>
            <span className="text-xs text-ink-400">of {summary?.total_timesheets || 0} total</span>
          </div>
          <p className="mt-1 text-xs text-ink-500">{summary?.approved_count || 0} approved to date</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Total Hours Logged</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{summary?.total_hours?.toFixed(1) || "0.0"} hrs</p>
          <p className="mt-1 text-xs text-ink-500">Across all active contracts</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Contractor Payouts</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {formatCurrency(summary?.total_labor_cost || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-500">Direct contractor wages</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">Gross Margin</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {formatCurrency(summary?.total_gross_margin || 0, currency)}
          </p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">
            Client Billed: {formatCurrency(summary?.total_bill_amount || 0, currency)}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3">
        {[
          { label: "All Timesheets", value: "ALL" },
          { label: `Pending Review (${summary?.pending_count || 0})`, value: "SUBMITTED" },
          { label: `Approved (${summary?.approved_count || 0})`, value: "APPROVED" },
          { label: `Revision Needed (${summary?.flagged_count || 0})`, value: "FLAGGED" },
          { label: "Drafts", value: "DRAFT" },
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

      {/* Timesheet List */}
      {!sheets || sheets.length === 0 ? (
        <EmptyState
          title="No Timesheets Found"
          description={
            statusFilter === "ALL"
              ? "When contractors log and submit weekly hours, they will appear here for review."
              : `There are currently no timesheets matching the '${statusFilter}' filter.`
          }
        />
      ) : (
        <div className="space-y-4">
          {sheets.map((sheet) => {
            const isPending = sheet.status === "SUBMITTED";
            const isApproved = sheet.status === "APPROVED";
            const isFlagged = sheet.status === "FLAGGED";

            return (
              <Card
                key={sheet.id}
                className={
                  isPending
                    ? "border-l-4 border-l-amber-500 shadow-sm"
                    : isApproved
                    ? "border-l-4 border-l-emerald-500"
                    : isFlagged
                    ? "border-l-4 border-l-rose-500"
                    : ""
                }
              >
                <CardHeader className="flex flex-col justify-between gap-4 border-b border-ink-100 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-ink-900">{sheet.contractor_name}</span>
                      <span className="text-ink-400">·</span>
                      <span className="text-sm font-medium text-ink-700">{sheet.project_name}</span>

                      {isApproved ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                          ✓ Approved
                        </span>
                      ) : isPending ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">
                          ⏳ Pending Approval
                        </span>
                      ) : isFlagged ? (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-600/20">
                          ⚠️ Revision Requested
                        </span>
                      ) : (
                        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                          📝 Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      Week of {formatDate(sheet.week_start)} – {formatDate(sheet.week_end)}
                      {sheet.submitted_at && ` · Submitted on ${formatDate(sheet.submitted_at)}`}
                    </p>
                  </div>

                  {/* Financial & Review Actions */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-medium text-ink-400">Total Hours</p>
                      <p className="text-base font-bold text-ink-900">{sheet.total_hours} hrs</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-medium text-ink-400">Contractor Pay</p>
                      <p className="text-base font-bold text-ink-900">
                        {formatCurrency(sheet.labor_cost || sheet.compensation, sheet.currency || currency)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-medium text-emerald-700">Gross Margin</p>
                      <p className="text-base font-bold text-emerald-700">
                        {formatCurrency(sheet.gross_margin || 0, sheet.currency || currency)}
                        {sheet.gross_margin_percent !== undefined && (
                          <span className="ml-1 text-xs font-normal">({sheet.gross_margin_percent}%)</span>
                        )}
                      </p>
                    </div>

                    {/* Action buttons */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenFlag(sheet)}
                        >
                          Flag / Revise
                        </Button>
                        <Button
                          size="sm"
                          isLoading={reviewMutation.isPending}
                          onClick={() => handleApprove(sheet)}
                        >
                          Approve & Lock
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {/* Contractor Deliverables / Summary */}
                  {sheet.contractor_summary && (
                    <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
                      <span className="font-semibold text-ink-900">Contractor Deliverables: </span>
                      {sheet.contractor_summary}
                    </div>
                  )}

                  {sheet.vendor_comment && (
                    <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                      <span className="font-semibold">Vendor Remarks: </span>
                      {sheet.vendor_comment}
                    </div>
                  )}

                  {/* Daily Entries Grid */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-ink-100 text-ink-500 uppercase font-semibold">
                        <tr>
                          <th className="py-2">Date</th>
                          <th className="py-2">Hours</th>
                          <th className="py-2">Work Location</th>
                          <th className="py-2">Tasks & Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {sheet.entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-ink-50/50">
                            <td className="py-2.5 font-medium text-ink-900">{formatDate(entry.work_date)}</td>
                            <td className="py-2.5 font-bold text-ink-900">
                              {entry.total_hours} hrs
                              {entry.overtime_hours > 0 && (
                                <span className="ml-1 text-[11px] font-normal text-amber-600">
                                  ({entry.overtime_hours} OT)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-ink-600">{entry.work_location || "Remote"}</td>
                            <td className="py-2.5 text-ink-700">{entry.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Audit Trail */}
                  {sheet.audit_history && sheet.audit_history.length > 0 && (
                    <div className="border-t border-ink-100 pt-3">
                      <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">Audit Log</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-500">
                        {sheet.audit_history.map((log, idx) => (
                          <span key={idx} className="rounded bg-ink-100 px-2 py-0.5 text-[11px]">
                            {log}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Flag / Revision Modal */}
      {isFlagModalOpen && selectedSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-ink-900">Request Timesheet Revision</h3>
            <p className="text-xs text-ink-500">
              Provide feedback for <span className="font-semibold text-ink-800">{selectedSheet.contractor_name}</span>. The contractor will be notified to correct and re-submit their weekly hours.
            </p>

            <div>
              <Label htmlFor="flag_comment">Reason for Revision *</Label>
              <Textarea
                id="flag_comment"
                rows={3}
                required
                placeholder="e.g., Please clarify 10 hours logged on Wednesday; maximum standard daily hours is 8h."
                value={flagComment}
                onChange={(e) => setFlagComment(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsFlagModalOpen(false);
                  setSelectedSheet(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={reviewMutation.isPending}
                onClick={submitFlag}
              >
                Send Revision Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
