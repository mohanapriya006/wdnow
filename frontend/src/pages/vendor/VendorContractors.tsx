import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listMyContractors } from "@/api/contractors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import { ContractorStatusBadge, AssignmentStatusBadge } from "@/components/ui/Badge";
import { AddContractorDialog } from "./AddContractorDialog";

export function VendorContractors() {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: contractors, isLoading } = useQuery({
    queryKey: ["vendor-contractors"],
    queryFn: listMyContractors,
  });

  const filtered = (contractors || []).filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.skills || "").toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Contractors</h1>
          <p className="mt-1 text-sm text-ink-500">
            Contractors onboarded to your vendor program.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>+ Add Contractor</Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name, email, or skill…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "No contractors match your search" : "No contractors yet"}
            description={!search ? "Add your first contractor to start building your bench." : undefined}
            action={!search ? <Button onClick={() => setIsAddOpen(true)}>+ Add Contractor</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Contractor</th>
                  <th className="px-5 py-3 font-medium">Skills</th>
                  <th className="px-5 py-3 font-medium">Experience</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Current Assignment</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">{c.name}</p>
                      <p className="text-xs text-ink-400">{c.email}</p>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{c.skills || "—"}</td>
                    <td className="px-5 py-3 text-ink-600">{c.experience || "—"}</td>
                    <td className="px-5 py-3">
                      <ContractorStatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3">
                      {c.current_assignment_status ? (
                        <div className="flex items-center gap-2">
                          <span className="text-ink-700">{c.current_assignment_project}</span>
                          <AssignmentStatusBadge status={c.current_assignment_status} />
                        </div>
                      ) : (
                        <span className="text-ink-400">No assignment</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/vendor/contractors/${c.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                        <Link to={`/vendor/assignments/new?contractor_id=${c.id}`}>
                          <Button variant="ghost" size="sm">Assign</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddContractorDialog open={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
