import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listMyAssignments } from "@/api/assignments";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { AssignmentStatus } from "@/api/types";

export function VendorAssignments() {
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "ALL">("ALL");

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["vendor-assignments"],
    queryFn: listMyAssignments,
  });

  const filtered = (assignments || []).filter(
    (a) => statusFilter === "ALL" || a.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Assignments</h1>
          <p className="mt-1 text-sm text-ink-500">Work orders connecting contractors to projects.</p>
        </div>
        <Link to="/vendor/assignments/new">
          <Button>+ Create Assignment</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AssignmentStatus | "ALL")}
          className="max-w-xs"
        >
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="TERMINATED">Terminated</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No assignments found"
            description="Create a work order to place a contractor on a project."
            action={
              <Link to="/vendor/assignments/new">
                <Button>+ Create Assignment</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Assignment ID</th>
                  <th className="px-5 py-3 font-medium">Contractor</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Dates</th>
                  <th className="px-5 py-3 font-medium">Rates (pay / bill)</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-ink-500">{a.id}</td>
                    <td className="px-5 py-3 font-medium text-ink-900">{a.contractor_name}</td>
                    <td className="px-5 py-3 text-ink-700">{a.project_name}</td>
                    <td className="px-5 py-3 text-ink-600">{a.role}</td>
                    <td className="px-5 py-3 text-ink-600">
                      {formatDate(a.start_date)} → {formatDate(a.end_date)}
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {formatCurrency(a.pay_rate, a.currency)} / {formatCurrency(a.bill_rate, a.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <AssignmentStatusBadge status={a.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/vendor/assignments/${a.id}`}>
                        <Button variant="outline" size="sm">Manage</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
