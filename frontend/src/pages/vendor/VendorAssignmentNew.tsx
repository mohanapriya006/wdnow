import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { listMyContractors } from "@/api/contractors";
import { createAssignment } from "@/api/assignments";
import type { AssignmentCreatePayload } from "@/api/assignments";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert, PageLoader } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";

const emptyForm = {
  contractor_id: "",
  project_name: "",
  role: "",
  start_date: "",
  end_date: "",
  working_hours: 40,
  pay_rate: "",
  bill_rate: "",
  currency: "INR",
  notes: "",
};

export function VendorAssignmentNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedContractor = searchParams.get("contractor_id") || "";

  const { data: contractors, isLoading } = useQuery({
    queryKey: ["vendor-contractors"],
    queryFn: listMyContractors,
  });

  const [form, setForm] = useState({ ...emptyForm, contractor_id: preselectedContractor });
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: AssignmentCreatePayload) => createAssignment(payload),
    onSuccess: (assignment) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-contractors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      navigate(`/vendor/assignments/${assignment.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!form.contractor_id) {
      setValidationError("Please select a contractor.");
      return;
    }
    const payRate = parseFloat(form.pay_rate);
    const billRate = parseFloat(form.bill_rate);
    if (isNaN(payRate) || payRate <= 0 || isNaN(billRate) || billRate <= 0) {
      setValidationError("Pay rate and bill rate must be positive numbers.");
      return;
    }
    if (billRate < payRate) {
      setValidationError("Bill rate cannot be lower than pay rate.");
      return;
    }
    if (form.end_date && form.end_date < form.start_date) {
      setValidationError("End date cannot be before start date.");
      return;
    }

    mutation.mutate({
      contractor_id: form.contractor_id,
      project_name: form.project_name,
      role: form.role,
      start_date: form.start_date,
      end_date: form.end_date || null,
      working_hours: Number(form.working_hours),
      pay_rate: payRate,
      bill_rate: billRate,
      currency: form.currency,
      notes: form.notes || undefined,
    });
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/vendor/assignments" className="text-xs font-medium text-ink-500 hover:text-ink-800">
        ← Back to Assignments
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Create Assignment / Work Order</CardTitle>
            <CardDescription>
              Place a contractor on a project and define their pay and bill rate.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {(validationError || mutation.isError) && (
              <Alert variant="error">
                {validationError || extractErrorMessage(mutation.error)}
              </Alert>
            )}

            <div>
              <Label htmlFor="contractor">Contractor *</Label>
              <Select
                id="contractor"
                required
                value={form.contractor_id}
                onChange={(e) => setForm({ ...form, contractor_id: e.target.value })}
              >
                <option value="">Select a contractor…</option>
                {(contractors || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.skills ? `— ${c.skills}` : ""}
                  </option>
                ))}
              </Select>
              {(contractors || []).length === 0 && (
                <p className="mt-1.5 text-xs text-amber-600">
                  You have no contractors yet.{" "}
                  <Link to="/vendor/contractors" className="underline">Add one first</Link>.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="project_name">Project name *</Label>
                <Input
                  id="project_name"
                  required
                  placeholder="Payment Platform"
                  value={form.project_name}
                  onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  required
                  placeholder="Senior C++ Developer"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="start_date">Start date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="working_hours">Working hours / week *</Label>
                <Input
                  id="working_hours"
                  type="number"
                  min={1}
                  max={168}
                  required
                  value={form.working_hours}
                  onChange={(e) => setForm({ ...form, working_hours: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  id="currency"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="pay_rate">Pay rate (per hour) *</Label>
                <Input
                  id="pay_rate"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  placeholder="1500"
                  value={form.pay_rate}
                  onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bill_rate">Bill rate (per hour) *</Label>
                <Input
                  id="bill_rate"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  placeholder="2000"
                  value={form.bill_rate}
                  onChange={(e) => setForm({ ...form, bill_rate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Optional internal notes about this assignment…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            <Link to="/vendor/assignments">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" isLoading={mutation.isPending}>
              Create Assignment
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
