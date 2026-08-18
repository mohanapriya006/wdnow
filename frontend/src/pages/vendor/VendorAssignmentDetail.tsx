import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getAssignment, updateAssignment } from "@/api/assignments";
import type { AssignmentUpdatePayload } from "@/api/assignments";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert, PageLoader } from "@/components/ui/Feedback";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { extractErrorMessage } from "@/api/client";
import type { AssignmentStatus } from "@/api/types";

export function VendorAssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: assignment, isLoading, isError, error } = useQuery({
    queryKey: ["assignment", id],
    queryFn: () => getAssignment(id!),
    enabled: !!id,
  });

  const [form, setForm] = useState<AssignmentUpdatePayload>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      setForm({
        project_name: assignment.project_name,
        role: assignment.role,
        start_date: assignment.start_date,
        end_date: assignment.end_date,
        working_hours: assignment.working_hours,
        pay_rate: assignment.pay_rate,
        bill_rate: assignment.bill_rate,
        status: assignment.status,
        notes: assignment.notes || "",
      });
    }
  }, [assignment]);

  const mutation = useMutation({
    mutationFn: (payload: AssignmentUpdatePayload) => updateAssignment(id!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["assignment", id], updated);
      queryClient.invalidateQueries({ queryKey: ["vendor-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-contractors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      setSuccessMsg("Assignment updated successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <Alert variant="error">{extractErrorMessage(error)}</Alert>;
  if (!assignment) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/vendor/assignments" className="text-xs font-medium text-ink-500 hover:text-ink-800">
        ← Back to Assignments
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {assignment.project_name}{" "}
              <span className="ml-2 font-mono text-xs font-normal text-ink-400">{assignment.id}</span>
            </CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              Contractor: <span className="font-medium text-ink-700">{assignment.contractor_name}</span> · Vendor:{" "}
              {assignment.vendor_name}
            </p>
          </div>
          <AssignmentStatusBadge status={assignment.status} />
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {successMsg && <Alert variant="success">{successMsg}</Alert>}
            {mutation.isError && <Alert variant="error">{extractErrorMessage(mutation.error)}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="project_name">Project name</Label>
                <Input
                  id="project_name"
                  value={form.project_name || ""}
                  onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={form.role || ""}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="start_date">Start date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date || ""}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date || ""}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="working_hours">Working hours / week</Label>
                <Input
                  id="working_hours"
                  type="number"
                  min={1}
                  max={168}
                  value={form.working_hours ?? ""}
                  onChange={(e) => setForm({ ...form, working_hours: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as AssignmentStatus })}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="TERMINATED">Terminated</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="pay_rate">Pay rate (per hour)</Label>
                <Input
                  id="pay_rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.pay_rate ?? ""}
                  onChange={(e) => setForm({ ...form, pay_rate: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="bill_rate">Bill rate (per hour)</Label>
                <Input
                  id="bill_rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.bill_rate ?? ""}
                  onChange={(e) => setForm({ ...form, bill_rate: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" isLoading={mutation.isPending}>
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
