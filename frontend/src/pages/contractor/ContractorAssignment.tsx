/**
 * Contractor assignments.
 *
 * A contractor can be placed on several projects at once, so this page lists
 * every live assignment rather than a single one. Read-only: the vendor owns
 * these terms. The client bill rate is never sent to this role.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getMyContractorAssignments } from "@/api/contractors";
import type { ContractorAssignmentView } from "@/api/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export function ContractorAssignment() {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["contractor-assignments"],
    queryFn: getMyContractorAssignments,
  });

  if (isLoading) return <PageLoader />;
  const count = assignments?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">
          {count > 1 ? "My Assignments" : "My Assignment"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {count > 1
            ? `You are placed on ${count} projects. Log each day against the project it belongs to.`
            : "Your current work order, as set by your vendor. You can view but not modify this information."}
        </p>
      </div>

      {!count ? (
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
        <div className="space-y-5">
          {assignments!.map((a) => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {count > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink-900">Log your time</h3>
              <p className="mt-0.5 text-sm text-ink-500">
                {count > 1
                  ? "Choose the project when you log a day. Hours that overlap across projects are flagged for your vendor."
                  : "Record start and end times each day; approved weeks become invoiceable hours."}
              </p>
            </div>
            <Link to="/contractor/timesheets">
              <Button variant="outline" size="sm">Go to Timesheets</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: ContractorAssignmentView }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-700 to-brand-600 px-6 py-5 text-white">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-100">
            {assignment.id}
          </p>
          <h2 className="mt-1 text-xl font-bold">{assignment.project_name}</h2>
          <p className="text-sm text-brand-100">{assignment.role}</p>
        </div>
        <AssignmentStatusBadge status={assignment.status} />
      </div>

      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field label="Vendor" value={assignment.vendor_name} />
          <Field label="Working hours" value={`${assignment.working_hours} hrs / week`} />
          <Field
            label="Work mode & location"
            value={`${assignment.work_mode || "—"}${assignment.location ? ` · ${assignment.location}` : ""}`}
          />
          <Field label="Start date" value={formatDate(assignment.start_date)} />
          <Field label="End date" value={formatDate(assignment.end_date)} />
          <div className="sm:col-span-2">
            <Label>Required skills</Label>
            <p className="mt-1 text-sm font-medium text-ink-800">
              {assignment.required_skills || "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Project description</Label>
            <p className="mt-1 text-sm text-ink-700">{assignment.description || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Pay rate</Label>
            <p className="mt-1 text-2xl font-bold text-brand-700">
              {formatCurrency(assignment.pay_rate, assignment.currency)}
              <span className="text-sm font-medium text-ink-400"> / hour</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase text-ink-400">{children}</p>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-1 text-sm font-medium text-ink-800">{value}</p>
    </div>
  );
}
