import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getMyVendorDashboard } from "@/api/vendors";
import { listMyContractors } from "@/api/contractors";
import { listMyAssignments } from "@/api/assignments";
import { listProjects } from "@/api/projects";
import { StatCard, Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import { AssignmentStatusBadge, ContractorStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export function VendorDashboard() {
  const { data: dashboard, isLoading: loadingDash } = useQuery({
    queryKey: ["vendor-dashboard"],
    queryFn: getMyVendorDashboard,
  });
  const { data: contractors, isLoading: loadingContractors } = useQuery({
    queryKey: ["vendor-contractors"],
    queryFn: listMyContractors,
  });
  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ["vendor-assignments"],
    queryFn: listMyAssignments,
  });
  const { data: projects } = useQuery({ queryKey: ["vendor-projects"], queryFn: listProjects });

  if (loadingDash) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">
            {dashboard?.vendor.name}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Vendor program overview — contractors, assignments, and workflow status.
          </p>
        </div>
        <Link to="/vendor/assignments/new">
          <Button>+ Create Assignment</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Contractors"
          value={dashboard?.active_contractors_count ?? 0}
          hint={`${dashboard?.total_contractors_count ?? 0} total`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
          }
        />
        <StatCard
          label="Active Assignments"
          value={dashboard?.active_assignments_count ?? 0}
          hint={`${dashboard?.total_assignments_count ?? 0} total`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75M8.25 4.5v.75c0 .414.336.75.75.75h6a.75.75 0 00.75-.75V4.5m-7.5 0a.75.75 0 01.75-.75h6a.75.75 0 01.75.75m-7.5 0v.75A2.25 2.25 0 0010.5 7.5h3A2.25 2.25 0 0015.75 5.25V4.5m-7.5 0H5.625c-.621 0-1.125.504-1.125 1.125V19.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H15.75" />
            </svg>
          }
        />
        <StatCard
          label="Projects"
          value={projects?.length ?? 0}
          hint={`${projects?.filter((p) => p.status === "OPEN" || p.status === "ACTIVE").length ?? 0} open / active`}
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M5.25 4.5h13.5a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V5.25a.75.75 0 01.75-.75z" /></svg>}
        />
        <StatCard
          label="Pending Timesheets"
          value={dashboard?.pending_timesheets_count ?? 0}
          hint="Phase 2 module"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Invoices"
          value={dashboard?.pending_invoices_count ?? 0}
          hint="Phase 2 module"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Projects</CardTitle><Link to="/vendor/projects"><Button variant="ghost" size="sm">Manage →</Button></Link></CardHeader>
          <CardContent className="p-0"><ul className="divide-y divide-ink-100">{(projects || []).slice(0, 4).map((p) => <li key={p.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-sm font-medium text-ink-900">{p.name}</p><p className="text-xs text-ink-500">{p.role} · {p.assigned_contractors_count} assigned</p></div><Link to={`/vendor/assignments/new?project_id=${p.id}`}><Button size="sm" variant="outline">Assign</Button></Link></li>)}</ul>{!projects?.length && <EmptyState title="No projects yet" description="Create a project to start staffing." />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contractors</CardTitle>
            <Link to="/vendor/contractors">
              <Button variant="ghost" size="sm">View all →</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loadingContractors ? (
              <PageLoader />
            ) : !contractors || contractors.length === 0 ? (
              <EmptyState title="No contractors yet" description="Add your first contractor to get started." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {contractors.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link to={`/vendor/contractors/${c.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-600">
                        {c.name}
                      </Link>
                      <p className="text-xs text-ink-500">{c.skills || "—"}</p>
                    </div>
                    <ContractorStatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <Link to="/vendor/assignments">
              <Button variant="ghost" size="sm">View all →</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loadingAssignments ? (
              <PageLoader />
            ) : !assignments || assignments.length === 0 ? (
              <EmptyState title="No assignments yet" description="Create a work order for one of your contractors." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {assignments.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link to={`/vendor/assignments/${a.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-600">
                        {a.project_name}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {a.contractor_name} · {formatCurrency(a.pay_rate, a.currency)}/hr · {formatDate(a.start_date)}
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
    </div>
  );
}
