import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getContractor } from "@/api/contractors";
import { listMyAssignments } from "@/api/assignments";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader, EmptyState, Alert } from "@/components/ui/Feedback";
import { ContractorStatusBadge, AssignmentStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatCurrency, initials } from "@/lib/utils";
import { extractErrorMessage } from "@/api/client";

export function VendorContractorDetail() {
  const { id } = useParams<{ id: string }>();

  const {
    data: contractor,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["contractor", id],
    queryFn: () => getContractor(id!),
    enabled: !!id,
  });

  const { data: allAssignments } = useQuery({
    queryKey: ["vendor-assignments"],
    queryFn: listMyAssignments,
  });

  const assignments = (allAssignments || []).filter((a) => a.contractor_id === id);

  if (isLoading) return <PageLoader />;
  if (isError) return <Alert variant="error">{extractErrorMessage(error)}</Alert>;
  if (!contractor) return null;

  return (
    <div className="space-y-6">
      <Link to="/vendor/contractors" className="text-xs font-medium text-ink-500 hover:text-ink-800">
        ← Back to Contractors
      </Link>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
              {initials(contractor.name)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-900">{contractor.name}</h1>
              <p className="text-sm text-ink-500">{contractor.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ContractorStatusBadge status={contractor.status} />
            <Link to={`/vendor/assignments/new?contractor_id=${contractor.id}`}>
              <Button size="sm">+ Create Assignment</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-ink-100 px-6 py-5 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Phone</p>
            <p className="mt-1 text-sm text-ink-800">{contractor.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Location</p>
            <p className="mt-1 text-sm text-ink-800">{contractor.location || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Experience</p>
            <p className="mt-1 text-sm text-ink-800">{contractor.experience || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Onboarded</p>
            <p className="mt-1 text-sm text-ink-800">{formatDate(contractor.created_at.slice(0, 10))}</p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-xs font-medium uppercase text-ink-400">Skills</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(contractor.skills || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700"
                  >
                    {skill}
                  </span>
                ))}
              {!contractor.skills && <span className="text-sm text-ink-400">—</span>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignment history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <EmptyState title="No assignments for this contractor yet" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link to={`/vendor/assignments/${a.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-600">
                      {a.project_name} — {a.role}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {formatCurrency(a.pay_rate, a.currency)}/hr pay · {formatCurrency(a.bill_rate, a.currency)}/hr bill ·{" "}
                      {formatDate(a.start_date)} → {formatDate(a.end_date)}
                    </p>
                  </div>
                  <AssignmentStatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
