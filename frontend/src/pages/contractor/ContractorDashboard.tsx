import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getMyContractorProfile, getMyContractorAssignment } from "@/api/contractors";
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

  if (loadingProfile) return <PageLoader />;

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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Project</p>
                <p className="mt-1 text-lg font-semibold text-ink-900">{assignmentData.assignment!.project_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Role</p>
                <p className="mt-1 text-lg font-semibold text-ink-900">{assignmentData.assignment!.role}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Vendor</p>
                <p className="mt-1 text-sm text-ink-700">{assignmentData.assignment!.vendor_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Duration</p>
                <p className="mt-1 text-sm text-ink-700">
                  {formatDate(assignmentData.assignment!.start_date)} → {formatDate(assignmentData.assignment!.end_date)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
