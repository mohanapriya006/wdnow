import { useQuery } from "@tanstack/react-query";
import { getMyContractorAssignment } from "@/api/contractors";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export function ContractorAssignment() {
  const { data, isLoading } = useQuery({
    queryKey: ["contractor-assignment"],
    queryFn: getMyContractorAssignment,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My Assignment</h1>
        <p className="mt-1 text-sm text-ink-500">
          Your current work order, as set by your vendor. You can view but not modify this information.
        </p>
      </div>

      {!data?.has_assignment ? (
        <Card>
          <EmptyState
            title="No active assignment"
            description="Your vendor hasn't placed you on a project yet. Once they create an assignment for you, it will appear here immediately."
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75M8.25 4.5v.75c0 .414.336.75.75.75h6a.75.75 0 00.75-.75V4.5" />
              </svg>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-brand-700 to-brand-600 px-6 py-5 text-white">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-100">
                {data.assignment!.id}
              </p>
              <h2 className="mt-1 text-xl font-bold">{data.assignment!.project_name}</h2>
              <p className="text-sm text-brand-100">{data.assignment!.role}</p>
            </div>
            <AssignmentStatusBadge status={data.assignment!.status} />
          </div>

          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Vendor</p>
                <p className="mt-1 text-sm font-medium text-ink-800">{data.assignment!.vendor_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Working hours</p>
                <p className="mt-1 text-sm font-medium text-ink-800">{data.assignment!.working_hours} hrs / week</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Work mode & location</p>
                <p className="mt-1 text-sm font-medium text-ink-800">{data.assignment!.work_mode || "—"}{data.assignment!.location ? ` · ${data.assignment!.location}` : ""}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">Start date</p>
                <p className="mt-1 text-sm font-medium text-ink-800">{formatDate(data.assignment!.start_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-ink-400">End date</p>
                <p className="mt-1 text-sm font-medium text-ink-800">{formatDate(data.assignment!.end_date)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-ink-400">Required skills</p>
                <p className="mt-1 text-sm font-medium text-ink-800">{data.assignment!.required_skills || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-ink-400">Project description</p>
                <p className="mt-1 text-sm text-ink-700">{data.assignment!.description || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-ink-400">Pay rate</p>
                <p className="mt-1 text-2xl font-bold text-brand-700">
                  {formatCurrency(data.assignment!.pay_rate, data.assignment!.currency)}
                  <span className="text-sm font-medium text-ink-400"> / hour</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
