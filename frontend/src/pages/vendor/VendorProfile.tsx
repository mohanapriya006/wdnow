import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyVendorProfile, updateMyVendorProfile } from "@/api/vendors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { VendorStatusBadge } from "@/components/ui/Badge";
import { extractErrorMessage } from "@/api/client";
import { formatDate } from "@/lib/utils";

export function VendorProfile() {
  const queryClient = useQueryClient();
  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-me"],
    queryFn: getMyVendorProfile,
  });

  const [form, setForm] = useState({ name: "", phone: "", address: "", tax_id: "" });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name || "",
        phone: vendor.phone || "",
        address: vendor.address || "",
        tax_id: vendor.tax_id || "",
      });
    }
  }, [vendor]);

  const mutation = useMutation({
    mutationFn: updateMyVendorProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(["vendor-me"], updated);
      queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      setSuccessMsg("Profile updated successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  if (isLoading || !vendor) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Vendor Profile</h1>
        <p className="mt-1 text-sm text-ink-500">Manage your company's information on the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Company details</CardTitle>
            <CardDescription>
              Vendor ID {vendor.id} · Onboarded {formatDate(vendor.created_at.slice(0, 10))}
            </CardDescription>
          </div>
          <VendorStatusBadge status={vendor.status} />
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {successMsg && <Alert variant="success">{successMsg}</Alert>}
            {mutation.isError && <Alert variant="error">{extractErrorMessage(mutation.error)}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Company name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email (read-only)</Label>
                <Input id="email" value={vendor.email} disabled className="bg-ink-50 text-ink-500" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tax_id">Registration / Tax ID</Label>
                <Input
                  id="tax_id"
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
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
