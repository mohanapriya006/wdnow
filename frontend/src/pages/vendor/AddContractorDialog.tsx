import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addContractor } from "@/api/contractors";
import type { ContractorCreatePayload } from "@/api/contractors";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { extractErrorMessage } from "@/api/client";

const emptyForm: ContractorCreatePayload = {
  name: "",
  email: "",
  phone: "",
  skills: "",
  experience: "",
  location: "",
};

export function AddContractorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContractorCreatePayload>(emptyForm);

  const mutation = useMutation({
    mutationFn: addContractor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-contractors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      setForm(emptyForm);
      onClose();
    },
  });

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  function handleClose() {
    mutation.reset();
    setForm(emptyForm);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Add Contractor</h2>
            <p className="text-xs text-ink-500">
              Creates a contractor record and a login account under your vendor.
            </p>
          </div>
          <button onClick={handleClose} className="text-ink-400 hover:text-ink-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            {mutation.isError && <Alert variant="error">{extractErrorMessage(mutation.error)}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="c-name">Full name *</Label>
                <Input
                  id="c-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Priya Sharma"
                />
              </div>
              <div>
                <Label htmlFor="c-email">Email *</Label>
                <Input
                  id="c-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="priya@example.com"
                />
              </div>
              <div>
                <Label htmlFor="c-phone">Phone</Label>
                <Input
                  id="c-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91-9876543210"
                />
              </div>
              <div>
                <Label htmlFor="c-location">Location</Label>
                <Input
                  id="c-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Bengaluru, India"
                />
              </div>
              <div>
                <Label htmlFor="c-skills">Skills</Label>
                <Input
                  id="c-skills"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="C++, Kafka, Redis"
                />
              </div>
              <div>
                <Label htmlFor="c-experience">Experience</Label>
                <Input
                  id="c-experience"
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  placeholder="5 years"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="c-password">Temporary Password (optional)</Label>
              <Input
                id="c-password"
                type="password"
                value={form.password || ""}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Leave blank for default: Contractor@123"
              />
            </div>

            <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
              A login account is created automatically for this contractor. They can sign in immediately
              using their email and the temporary password (default: <span className="font-mono font-medium text-ink-700">Contractor@123</span>).
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-ink-100 px-6 py-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Add Contractor
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
