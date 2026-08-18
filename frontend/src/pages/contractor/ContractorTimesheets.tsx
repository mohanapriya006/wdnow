import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { myTimesheets, saveWeeklyBatchTimesheet } from "@/api/timesheets";
import { getMyContractorAssignment } from "@/api/contractors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PageLoader, Alert, EmptyState } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Timesheet, WeeklyDayEntryPayload } from "@/api/types";

// Helper: Get Monday of the week for any given date
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ContractorTimesheets() {
  const qc = useQueryClient();
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => getMonday(new Date()));
  const [contractorSummary, setContractorSummary] = useState("");
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [dailyHours, setDailyHours] = useState<Record<string, number>>({});
  const [dailyLocations, setDailyLocations] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mondayStr = useMemo(() => toISODate(selectedMonday), [selectedMonday]);
  const sundayStr = useMemo(() => toISODate(addDays(selectedMonday, 6)), [selectedMonday]);

  // Fetch contractor assignment & rates
  const { data: assignmentData, isLoading: loadingAssignment } = useQuery({
    queryKey: ["contractor-assignment"],
    queryFn: getMyContractorAssignment,
  });

  // Fetch all contractor timesheets
  const { data: sheets, isLoading: loadingSheets } = useQuery({
    queryKey: ["my-timesheets"],
    queryFn: myTimesheets,
  });

  // Find timesheet matching selected week
  const currentSheet: Timesheet | undefined = useMemo(() => {
    return (sheets || []).find((s) => s.week_start === mondayStr);
  }, [sheets, mondayStr]);

  const isLocked = currentSheet?.status === "APPROVED";
  const isSubmitted = currentSheet?.status === "SUBMITTED";

  // Populate local form state whenever currentSheet or selectedMonday changes
  useEffect(() => {
    const hoursMap: Record<string, number> = {};
    const notesMap: Record<string, string> = {};
    const locMap: Record<string, string> = {};

    for (let i = 0; i < 7; i++) {
      const dayDateStr = toISODate(addDays(selectedMonday, i));
      hoursMap[dayDateStr] = 0;
      notesMap[dayDateStr] = "";
      locMap[dayDateStr] = "Remote";
    }

    if (currentSheet && currentSheet.entries) {
      for (const entry of currentSheet.entries) {
        hoursMap[entry.work_date] = entry.total_hours;
        notesMap[entry.work_date] = entry.notes || "";
        locMap[entry.work_date] = entry.work_location || "Remote";
      }
      setContractorSummary(currentSheet.contractor_summary || "");
    } else {
      setContractorSummary("");
    }

    setDailyHours(hoursMap);
    setDailyNotes(notesMap);
    setDailyLocations(locMap);
    setSuccessMessage(null);
  }, [selectedMonday, currentSheet]);

  const saveMutation = useMutation({
    mutationFn: saveWeeklyBatchTimesheet,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["my-timesheets"] });
      setSuccessMessage(
        data.status === "SUBMITTED"
          ? "Weekly timesheet submitted successfully for vendor approval!"
          : "Timesheet draft saved successfully."
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  // Week calculation helpers
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dateObj = addDays(selectedMonday, i);
      const dateStr = toISODate(dateObj);
      return {
        name: DAY_NAMES[i],
        dateStr,
        dateFormatted: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isWeekend: i >= 5,
      };
    });
  }, [selectedMonday]);

  const totalWeekHours = useMemo(() => {
    return Object.values(dailyHours).reduce((sum, h) => sum + (Number(h) || 0), 0);
  }, [dailyHours]);

  const payRate = assignmentData?.assignment?.pay_rate || 0;
  const currency = assignmentData?.assignment?.currency || "INR";
  const regularHours = Math.min(totalWeekHours, 40);
  const overtimeHours = Math.max(totalWeekHours - 40, 0);
  const estimatedEarnings = totalWeekHours * payRate;

  function handleHourChange(dateStr: string, value: string) {
    if (isLocked || isSubmitted) return;
    const num = Math.max(0, Math.min(24, parseFloat(value) || 0));
    setDailyHours((prev) => ({ ...prev, [dateStr]: num }));
  }

  function handleFillStandardWeek() {
    if (isLocked || isSubmitted) return;
    const updated: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const dateStr = toISODate(addDays(selectedMonday, i));
      updated[dateStr] = i < 5 ? 8 : 0;
    }
    setDailyHours(updated);
  }

  function handleClearWeek() {
    if (isLocked || isSubmitted) return;
    const updated: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const dateStr = toISODate(addDays(selectedMonday, i));
      updated[dateStr] = 0;
    }
    setDailyHours(updated);
  }

  function handleSave(submitNow: boolean) {
    const entries: WeeklyDayEntryPayload[] = weekDays.map((d) => ({
      work_date: d.dateStr,
      hours: dailyHours[d.dateStr] || 0,
      notes: dailyNotes[d.dateStr] || undefined,
      work_location: dailyLocations[d.dateStr] || "Remote",
    }));

    saveMutation.mutate({
      week_start: mondayStr,
      entries,
      submit_now: submitNow,
      contractor_summary: contractorSummary || undefined,
    });
  }

  if (loadingAssignment || loadingSheets) return <PageLoader />;

  if (!assignmentData?.has_assignment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Weekly Timesheets</h1>
          <p className="mt-1 text-sm text-ink-500">Track and submit your working hours for vendor payroll.</p>
        </div>
        <EmptyState
          title="No Active Assignment"
          description="You are currently on bench. Timesheet submission is enabled as soon as your vendor assigns you to a project."
        />
      </div>
    );
  }

  const assignment = assignmentData.assignment!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Weekly Timesheets</h1>
          <p className="mt-1 text-sm text-ink-500">
            Project: <span className="font-semibold text-ink-700">{assignment.project_name}</span> · Role:{" "}
            <span className="font-medium text-ink-700">{assignment.role}</span>
          </p>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedMonday((prev) => addDays(prev, -7))}
          >
            ← Prev Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedMonday(getMonday(new Date()))}
          >
            Current Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedMonday((prev) => addDays(prev, 7))}
          >
            Next Week →
          </Button>
        </div>
      </div>

      {/* Week Title & Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 font-bold">
            📅
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">
              Week of {formatDate(mondayStr)} – {formatDate(sundayStr)}
            </h2>
            <p className="text-xs text-ink-500">7-Day Timesheet Logging Window</p>
          </div>
        </div>

        <div>
          {currentSheet?.status === "APPROVED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              ✓ Approved & Locked
            </span>
          ) : currentSheet?.status === "SUBMITTED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
              ⏳ Submitted (Pending Review)
            </span>
          ) : currentSheet?.status === "FLAGGED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
              ⚠️ Revision Requested
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700">
              📝 Draft (Not Submitted)
            </span>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {saveMutation.isError && <Alert variant="error">{extractErrorMessage(saveMutation.error)}</Alert>}

      {currentSheet?.status === "FLAGGED" && currentSheet.vendor_comment && (
        <Alert variant="warning">
          <strong>Vendor Feedback:</strong> {currentSheet.vendor_comment}. Please update your hours and re-submit.
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Total Hours</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{totalWeekHours.toFixed(1)} hrs</p>
          <p className="mt-1 text-xs text-ink-500">
            {regularHours.toFixed(1)} Regular · {overtimeHours.toFixed(1)} Overtime
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Pay Rate</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatCurrency(payRate, currency)}</p>
          <p className="mt-1 text-xs text-ink-500">Per billable hour</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Estimated Pay</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{formatCurrency(estimatedEarnings, currency)}</p>
          <p className="mt-1 text-xs text-ink-500">For this weekly cycle</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Standard Target</p>
          <p className="mt-1 text-2xl font-bold text-ink-700">40.0 hrs</p>
          <p className="mt-1 text-xs text-ink-500">
            {totalWeekHours >= 40 ? "🎯 Target achieved" : `${(40 - totalWeekHours).toFixed(1)} hrs remaining`}
          </p>
        </div>
      </div>

      {/* Interactive Timesheet Grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-ink-100 pb-4">
          <CardTitle>Daily Hours Entry</CardTitle>
          {!isLocked && !isSubmitted && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleFillStandardWeek}>
                ⚡ Fill 8h Mon–Fri
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearWeek}>
                Clear
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/70 text-xs font-semibold uppercase tracking-wider text-ink-600">
                <tr>
                  <th className="py-3.5 pl-6 pr-3">Day & Date</th>
                  <th className="px-3 py-3.5 w-32">Hours</th>
                  <th className="px-3 py-3.5 w-36">Location</th>
                  <th className="py-3.5 pl-3 pr-6">Work Summary / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {weekDays.map((day) => {
                  const hoursVal = dailyHours[day.dateStr] || 0;
                  return (
                    <tr
                      key={day.dateStr}
                      className={day.isWeekend ? "bg-ink-50/40 hover:bg-ink-50/70" : "hover:bg-ink-50/40"}
                    >
                      <td className="py-3.5 pl-6 pr-3 font-medium text-ink-900">
                        <div className="flex flex-col">
                          <span className={day.isWeekend ? "text-ink-500" : "text-ink-900 font-semibold"}>
                            {day.name}
                          </span>
                          <span className="text-xs text-ink-400">{day.dateFormatted}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            disabled={isLocked || isSubmitted}
                            value={hoursVal === 0 ? "" : hoursVal}
                            placeholder="0"
                            className="h-9 w-20 text-center font-semibold"
                            onChange={(e) => handleHourChange(day.dateStr, e.target.value)}
                          />
                          <span className="text-xs font-medium text-ink-400">h</span>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <select
                          disabled={isLocked || isSubmitted}
                          value={dailyLocations[day.dateStr] || "Remote"}
                          onChange={(e) =>
                            setDailyLocations((prev) => ({ ...prev, [day.dateStr]: e.target.value }))
                          }
                          className="h-9 w-full rounded-lg border border-ink-200 bg-white px-2.5 text-xs text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none"
                        >
                          <option value="Remote">Remote</option>
                          <option value="Client Office">Client Office</option>
                          <option value="Hybrid">Hybrid</option>
                        </select>
                      </td>

                      <td className="py-3.5 pl-3 pr-6">
                        <Input
                          type="text"
                          disabled={isLocked || isSubmitted}
                          placeholder="What did you work on today? (e.g. API integration, code review...)"
                          value={dailyNotes[day.dateStr] || ""}
                          className="h-9 text-xs"
                          onChange={(e) =>
                            setDailyNotes((prev) => ({ ...prev, [day.dateStr]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-ink-200 bg-ink-50/80 font-semibold text-ink-900">
                <tr>
                  <td className="py-3.5 pl-6 pr-3">Total Week Hours</td>
                  <td className="px-3 py-3.5 text-base font-bold text-brand-700">
                    {totalWeekHours.toFixed(1)} hrs
                  </td>
                  <td colSpan={2} className="py-3.5 pl-3 pr-6 text-right text-xs text-ink-500">
                    Total Compensation:{" "}
                    <span className="font-bold text-ink-900 text-sm">
                      {formatCurrency(estimatedEarnings, currency)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Submission notes & Action Bar */}
          <div className="space-y-4 border-t border-ink-200 p-6">
            <div>
              <Label htmlFor="contractor_summary">Weekly Summary / Deliverables (Optional)</Label>
              <Textarea
                id="contractor_summary"
                disabled={isLocked || isSubmitted}
                rows={2}
                placeholder="Add any overall highlights, milestones delivered, or notes for your vendor reviewer..."
                value={contractorSummary}
                onChange={(e) => setContractorSummary(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-ink-400">
                {isLocked ? (
                  <span>🔒 This timesheet is approved and locked.</span>
                ) : isSubmitted ? (
                  <span>⏳ Submitted. Awaiting review from {assignment.vendor_name}.</span>
                ) : (
                  <span>💾 Changes can be saved as a draft anytime before final submission.</span>
                )}
              </div>

              {!isLocked && (
                <div className="flex items-center gap-3">
                  {!isSubmitted && (
                    <Button
                      variant="outline"
                      isLoading={saveMutation.isPending}
                      onClick={() => handleSave(false)}
                    >
                      Save Draft
                    </Button>
                  )}
                  <Button
                    isLoading={saveMutation.isPending}
                    onClick={() => handleSave(true)}
                  >
                    {isSubmitted ? "Update & Re-Submit" : "Submit Timesheet for Approval →"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheet Submission History</CardTitle>
        </CardHeader>
        <CardContent>
          {!sheets || sheets.length === 0 ? (
            <p className="text-sm text-ink-500">No timesheets recorded yet.</p>
          ) : (
            <div className="divide-y divide-ink-100 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs font-semibold uppercase text-ink-400">
                  <tr>
                    <th className="py-2.5">Week Period</th>
                    <th className="py-2.5">Total Hours</th>
                    <th className="py-2.5">Total Compensation</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sheets.map((s) => (
                    <tr key={s.id} className="hover:bg-ink-50/50">
                      <td className="py-3 font-medium text-ink-900">
                        {formatDate(s.week_start)} – {formatDate(s.week_end)}
                      </td>
                      <td className="py-3 text-ink-700 font-semibold">{s.total_hours} hrs</td>
                      <td className="py-3 font-bold text-brand-700">
                        {formatCurrency(s.compensation, s.currency || currency)}
                      </td>
                      <td className="py-3">
                        {s.status === "APPROVED" ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Approved
                          </span>
                        ) : s.status === "SUBMITTED" ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            Submitted
                          </span>
                        ) : s.status === "FLAGGED" ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                            Revision Needed
                          </span>
                        ) : (
                          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMonday(new Date(s.week_start))}
                        >
                          View Week →
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
    </div>
  );
}
