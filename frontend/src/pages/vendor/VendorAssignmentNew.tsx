import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listMyContractors } from "@/api/contractors";
import { listProjects } from "@/api/projects";
import { createAssignment } from "@/api/assignments";
import { getProjectRecommendations } from "@/api/ai";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Alert, PageLoader } from "@/components/ui/Feedback";
import { Badge } from "@/components/ui/Badge";
import { extractErrorMessage } from "@/api/client";

export function VendorAssignmentNew() {
  const navigate = useNavigate(), queryClient = useQueryClient(), [params] = useSearchParams();
  const [form, setForm] = useState({
    contractor_id: params.get("contractor_id") || "",
    project_id: params.get("project_id") || "",
    start_date: "",
    end_date: "",
    notes: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [rejectedContractorIds, setRejectedContractorIds] = useState<string[]>([]);

  const { data: contractors, isLoading: loadingContractors } = useQuery({
    queryKey: ["vendor-contractors"],
    queryFn: listMyContractors
  });

  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ["vendor-projects"],
    queryFn: listProjects
  });

  const {
    data: aiRecommendations,
    isLoading: loadingAI,
    isFetching: fetchingAI,
  } = useQuery({
    queryKey: ["ai-project-recommendations", form.project_id],
    queryFn: () => getProjectRecommendations(form.project_id),
    enabled: !!form.project_id,
  });

  const mutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: (assignment) => {
      ["vendor-assignments", "vendor-contractors", "vendor-dashboard", "vendor-projects"].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
      navigate(`/vendor/assignments/${assignment.id}`);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.contractor_id || !form.project_id) {
      return setError("Select both a contractor and a project.");
    }
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      return setError("End date cannot be before start date.");
    }
    mutation.mutate({
      ...form,
      start_date: form.start_date || undefined,
      end_date: form.end_date || null,
      notes: form.notes || undefined,
    });
  }

  function handleSelectContractor(contractorId: string) {
    setForm((prev) => ({ ...prev, contractor_id: contractorId }));
  }

  function handleRejectRecommendation(contractorId: string) {
    setRejectedContractorIds((prev) => [...prev, contractorId]);
    if (form.contractor_id === contractorId) {
      setForm((prev) => ({ ...prev, contractor_id: "" }));
    }
  }

  if (loadingContractors || loadingProjects) return <PageLoader />;

  const visibleRecommendations = (aiRecommendations?.recommendations || []).filter(
    (rec) => !rejectedContractorIds.includes(rec.contractor_id)
  );

  const selectedProject = (projects || []).find((p) => p.id === form.project_id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/vendor/assignments" className="text-xs font-medium text-ink-500 hover:text-ink-700">
        ← Back to Assignments
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Assign contractor</CardTitle>
            <CardDescription>
              Place a contractor on an existing project. Project terms are snapshotted for downstream timesheets, analytics, and invoices.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={submit}>
          <CardContent className="space-y-6">
            {(error || mutation.isError) && (
              <Alert variant="error">{error || extractErrorMessage(mutation.error)}</Alert>
            )}

            <div>
              <Label>Project *</Label>
              <Select
                value={form.project_id}
                onChange={(e) => {
                  setForm({ ...form, project_id: e.target.value });
                  setRejectedContractorIds([]);
                }}
                required
              >
                <option value="">Select a project…</option>
                {(projects || [])
                  .filter((p) => p.status === "OPEN" || p.status === "ACTIVE")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.role}
                    </option>
                  ))}
              </Select>
              {!(projects || []).length && (
                <p className="mt-1 text-xs text-amber-600">
                  Create a{" "}
                  <Link className="underline" to="/vendor/projects">
                    project
                  </Link>{" "}
                  first.
                </p>
              )}
            </div>

            {/* ✨ AI Recommended Contractors Section */}
            {form.project_id && (
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-white p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white shadow-sm">
                      ✨
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">
                        AI Recommended Contractors
                      </h3>
                      <p className="text-xs text-ink-500">
                        Ranked by skill match (45%), experience (20%), location (15%), and availability (20%)
                      </p>
                    </div>
                  </div>
                  {fetchingAI && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Analyzing candidates…
                    </span>
                  )}
                </div>

                {loadingAI ? (
                  <div className="py-6 text-center text-xs text-ink-500">
                    Evaluating workforce pool against {selectedProject?.name || "project"} requirements…
                  </div>
                ) : visibleRecommendations.length === 0 ? (
                  <div className="py-4 text-center text-xs text-ink-500 bg-white/70 rounded-lg border border-dashed border-slate-200">
                    {rejectedContractorIds.length > 0
                      ? "All suggestions reviewed for this project."
                      : "No active contractors found for matching."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {visibleRecommendations.map((rec) => {
                      const isSelected = form.contractor_id === rec.contractor_id;
                      const isOnBench = rec.status === "ON_BENCH";

                      const recommendationLabel =
                        rec.recommendation === "STRONG_MATCH"
                          ? "Strong Match"
                          : rec.recommendation === "GOOD_MATCH"
                          ? "Good Match"
                          : rec.recommendation === "POTENTIAL_MATCH"
                          ? "Potential Match"
                          : "Weak Match";

                      const recBadgeClass =
                        rec.recommendation === "STRONG_MATCH"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : rec.recommendation === "GOOD_MATCH"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : rec.recommendation === "POTENTIAL_MATCH"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-200";

                      return (
                        <div
                          key={rec.contractor_id}
                          className={`rounded-lg border p-4 transition-all bg-white ${
                            isSelected
                              ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md"
                              : "border-slate-200/90 hover:border-indigo-200 shadow-sm"
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-ink-900 text-sm">{rec.name}</span>
                                <Badge className="bg-indigo-600 text-white font-bold text-xs px-2 py-0.5">
                                  {Math.round(rec.match_score)}% Match
                                </Badge>
                                <Badge className={`border text-xs px-2 py-0.5 font-medium ${recBadgeClass}`}>
                                  {recommendationLabel}
                                </Badge>
                                {isOnBench ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                                    ● On Bench
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-xs">
                                    ⚡ Already Assigned
                                  </Badge>
                                )}
                              </div>

                              {!isOnBench && rec.current_project && (
                                <p className="text-xs text-amber-800 font-medium">
                                  Currently working on: <span className="font-semibold">{rec.current_project}</span>
                                </p>
                              )}

                              {rec.explanation && (
                                <div className="rounded-md bg-slate-50/80 p-2.5 text-xs text-ink-700 border border-slate-200/70 flex items-start gap-2">
                                  <span className="text-indigo-600 mt-0.5">💡</span>
                                  <span>{rec.explanation}</span>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600 pt-1">
                                <div>
                                  <span className="font-medium text-ink-700">Experience: </span>
                                  {rec.experience || (rec.experience_years ? `${rec.experience_years} years` : "Not specified")}
                                </div>
                                <div>
                                  <span className="font-medium text-ink-700">Location: </span>
                                  {rec.location || "Remote / Any"}
                                </div>
                              </div>

                              <div className="space-y-1 pt-1">
                                {rec.matched_skills.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-emerald-700">Matched:</span>
                                    {rec.matched_skills.map((skill) => (
                                      <span
                                        key={skill}
                                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      >
                                        ✓ {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {rec.missing_skills.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-ink-400">Missing:</span>
                                    {rec.missing_skills.map((skill) => (
                                      <span
                                        key={skill}
                                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] text-ink-400 bg-slate-100 border border-slate-200 line-through"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions Column */}
                            <div className="flex sm:flex-col items-center sm:items-end gap-2 pt-2 sm:pt-0 shrink-0">
                              {isOnBench ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isSelected ? "primary" : "outline"}
                                  onClick={() => handleSelectContractor(rec.contractor_id)}
                                  className="w-full sm:w-auto"
                                >
                                  {isSelected ? "✓ Selected" : "Select / Assign"}
                                </Button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isSelected ? "primary" : "outline"}
                                    onClick={() => handleSelectContractor(rec.contractor_id)}
                                  >
                                    {isSelected ? "✓ Accepted" : "Accept Recommendation"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRejectRecommendation(rec.contractor_id)}
                                    className="text-ink-400 hover:text-red-600"
                                    title="Dismiss recommendation from list"
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Contractor *</Label>
              <Select
                value={form.contractor_id}
                onChange={(e) => setForm({ ...form, contractor_id: e.target.value })}
                required
              >
                <option value="">Select a contractor…</option>
                {(contractors || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.status === "BENCH" ? "(On Bench)" : "(Assigned)"}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Assignment start date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Assignment end date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Internal assignment notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            <Link to="/vendor/assignments">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" isLoading={mutation.isPending}>
              Assign contractor
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
