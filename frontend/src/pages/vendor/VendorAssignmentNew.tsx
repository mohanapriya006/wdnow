import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listMyContractors } from "@/api/contractors";
import { listProjects } from "@/api/projects";
import { createAssignment } from "@/api/assignments";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Alert, PageLoader } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";

export function VendorAssignmentNew() {
  const navigate = useNavigate(), queryClient = useQueryClient(), [params] = useSearchParams();
  const [form, setForm] = useState({ contractor_id: params.get("contractor_id") || "", project_id: params.get("project_id") || "", start_date: "", end_date: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const { data: contractors, isLoading: loadingContractors } = useQuery({ queryKey: ["vendor-contractors"], queryFn: listMyContractors });
  const { data: projects, isLoading: loadingProjects } = useQuery({ queryKey: ["vendor-projects"], queryFn: listProjects });
  const mutation = useMutation({ mutationFn: createAssignment, onSuccess: assignment => { ["vendor-assignments", "vendor-contractors", "vendor-dashboard", "vendor-projects"].forEach(key => queryClient.invalidateQueries({ queryKey: [key] })); navigate(`/vendor/assignments/${assignment.id}`); } });
  function submit(e: React.FormEvent) { e.preventDefault(); setError(null); if (!form.contractor_id || !form.project_id) return setError("Select both a contractor and a project."); if (form.end_date && form.start_date && form.end_date < form.start_date) return setError("End date cannot be before start date."); mutation.mutate({ ...form, start_date: form.start_date || undefined, end_date: form.end_date || null, notes: form.notes || undefined }); }
  if (loadingContractors || loadingProjects) return <PageLoader />;
  return <div className="mx-auto max-w-2xl space-y-6"><Link to="/vendor/assignments" className="text-xs font-medium text-ink-500">← Back to Assignments</Link><Card><CardHeader><div><CardTitle>Assign contractor</CardTitle><CardDescription>Place a contractor on an existing project. Project terms are snapshotted for downstream timesheets, analytics and invoices.</CardDescription></div></CardHeader><form onSubmit={submit}><CardContent className="space-y-4">{(error || mutation.isError) && <Alert variant="error">{error || extractErrorMessage(mutation.error)}</Alert>}<div><Label>Contractor *</Label><Select value={form.contractor_id} onChange={e=>setForm({...form, contractor_id:e.target.value})} required><option value="">Select a contractor…</option>{(contractors || []).map(c=><option key={c.id} value={c.id}>{c.name} {c.status === "BENCH" ? "(On Bench)" : "(Assigned)"}</option>)}</Select></div><div><Label>Project *</Label><Select value={form.project_id} onChange={e=>setForm({...form, project_id:e.target.value})} required><option value="">Select a project…</option>{(projects || []).filter(p=>p.status === "OPEN" || p.status === "ACTIVE").map(p=><option key={p.id} value={p.id}>{p.name} — {p.role}</option>)}</Select>{!(projects || []).length && <p className="mt-1 text-xs text-amber-600">Create a <Link className="underline" to="/vendor/projects">project</Link> first.</p>}</div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label>Assignment start date</Label><Input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></div><div><Label>Assignment end date</Label><Input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></div></div><div><Label>Internal assignment notes</Label><Textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div></CardContent><CardFooter className="flex justify-end gap-2"><Link to="/vendor/assignments"><Button type="button" variant="outline">Cancel</Button></Link><Button type="submit" isLoading={mutation.isPending}>Assign contractor</Button></CardFooter></form></Card></div>;
}
