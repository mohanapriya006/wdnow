import { useQuery } from "@tanstack/react-query";
import { getMyContractorProfile } from "@/api/contractors";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Feedback";
import { ContractorStatusBadge } from "@/components/ui/Badge";
import { formatDate, initials } from "@/lib/utils";

export function ContractorProfile() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["contractor-me"],
    queryFn: getMyContractorProfile,
  });

  if (isLoading || !profile) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My Profile</h1>
        <p className="mt-1 text-sm text-ink-500">Your contractor profile and vendor relationship.</p>
      </div>

      <Card>
        <div className="flex items-center gap-4 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
            {initials(profile.name)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink-900">{profile.name}</h2>
            <p className="text-sm text-ink-500">{profile.email}</p>
          </div>
          <div className="ml-auto">
            <ContractorStatusBadge status={profile.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-ink-100 px-6 py-5 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Phone</p>
            <p className="mt-1 text-sm text-ink-800">{profile.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Location</p>
            <p className="mt-1 text-sm text-ink-800">{profile.location || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Experience</p>
            <p className="mt-1 text-sm text-ink-800">{profile.experience || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Onboarded</p>
            <p className="mt-1 text-sm text-ink-800">{formatDate(profile.created_at.slice(0, 10))}</p>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs font-medium uppercase text-ink-400">Skills</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(profile.skills || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((skill) => (
                  <span key={skill} className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
                    {skill}
                  </span>
                ))}
              {!profile.skills && <span className="text-sm text-ink-400">—</span>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-800">
            You are represented by <span className="font-semibold">{profile.vendor_name}</span>.
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Your vendor manages your assignments, pay rate, and program compliance. Contact them
            directly for any changes to your engagement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
