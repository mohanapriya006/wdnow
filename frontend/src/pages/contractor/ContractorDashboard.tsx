import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getMyContractorProfile, getMyContractorAssignment } from "@/api/contractors";
import { myTimesheets } from "@/api/timesheets";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import { AssignmentStatusBadge, ContractorStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export function ContractorDashboard() {
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["contractor-me"],
    queryFn: getMyContractorProfile,
  });
  const { data: assignmentData, isLoading: loadingAssignment } = useQuery({
    queryKey: ["contractor-assignment"],
    queryFn: getMyContractorAssignment,
  });
  const { data: timesheets } = useQuery({
    queryKey: ["my-timesheets"],
    queryFn: myTimesheets,
    enabled: !!assignmentData?.has_assignment,
  });

  if (loadingProfile) return <PageLoader />;

  const latestSheet = timesheets && timesheets.length > 0 ? timesheets[0] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Welcome back, {profile?.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Working with <span className="font-medium text-ink-700">{profile?.vendor_name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Assignment status"
          value={
            assignmentData?.has_assignment ? (
              <AssignmentStatusBadge status={assignmentData.assignment!.status} />
            ) : (
              <span className="text-base font-semibold text-amber-600">On Bench</span>
            )
          }
        />
        <StatCard
          label="Pay rate"
          value={
            assignmentData?.has_assignment
              ? `${formatCurrency(assignmentData.assignment!.pay_rate, assignmentData.assignment!.currency)}/hr`
              : "—"
          }
        />
        <StatCard
          label="Contractor status"
          value={profile ? <ContractorStatusBadge status={profile.status} /> : "—"}
        />
      </div>

      {/* Assignment & Timesheet Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Assignment Card */}
        <Card>
          <CardHeader>
            <CardTitle>My Assignment</CardTitle>
            {assignmentData?.has_assignment && (
              <Link to="/contractor/assignment">
                <Button variant="ghost" size="sm">View details →</Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {loadingAssignment ? (
              <PageLoader />
            ) : !assignmentData?.has_assignment ? (
              <EmptyState
                title="On Bench"
                description="Your vendor hasn't placed you on a project yet. You'll see it here as soon as it's created."
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase text-ink-400">Project & Role</p>
                  <p className="mt-1 text-lg font-semibold text-ink-900">{assignmentData.assignment!.project_name}</p>
                  <p className="text-sm font-medium text-ink-700">{assignmentData.assignment!.role}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-ink-100">
                  <div>
                    <p className="text-xs font-medium uppercase text-ink-400">Duration</p>
                    <p className="mt-1 text-xs text-ink-700">
                      {formatDate(assignmentData.assignment!.start_date)} → {formatDate(assignmentData.assignment!.end_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-ink-400">Weekly Hours</p>
                    <p className="mt-1 text-xs text-ink-700 font-semibold">{assignmentData.assignment!.working_hours} hrs/week</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timesheet Quick Action Card */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Timesheets</CardTitle>
            <Link to="/contractor/timesheets">
              <Button size="sm">Log Hours →</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!assignmentData?.has_assignment ? (
              <p className="text-sm text-ink-500">Timesheets are enabled once you are on an active assignment.</p>
            ) : !latestSheet ? (
              <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center">
                <p className="text-sm font-semibold text-ink-900">No hours logged for this week</p>
                <p className="mt-1 text-xs text-ink-500">Record your daily hours to track your weekly compensation.</p>
                <Link to="/contractor/timesheets" className="mt-3 inline-block">
                  <Button size="sm" variant="outline">Start Timesheet</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-ink-400">Latest Timesheet</p>
                    <p className="mt-1 text-sm font-bold text-ink-900">
                      Week of {formatDate(latestSheet.week_start)}
                    </p>
                  </div>
                  <div>
                    {latestSheet.status === "APPROVED" ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        ✓ Approved
                      </span>
                    ) : latestSheet.status === "SUBMITTED" ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        ⏳ Pending Approval
                      </span>
                    ) : latestSheet.status === "FLAGGED" ? (
                      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                        ⚠️ Revision Needed
                      </span>
                    ) : (
                      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                        📝 Draft
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-lg bg-ink-50 p-3">
                  <div>
                    <p className="text-xs text-ink-500">Hours Logged</p>
                    <p className="text-base font-bold text-ink-900">{latestSheet.total_hours} hrs</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Earned Pay</p>
                    <p className="text-base font-bold text-brand-700">
                      {formatCurrency(latestSheet.compensation, latestSheet.currency || assignmentData.assignment!.currency)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
