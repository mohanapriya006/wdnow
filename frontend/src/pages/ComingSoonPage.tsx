import { ComingSoon } from "@/components/ui/Feedback";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        <p className="mt-1 text-sm text-ink-500">This module is not yet part of the current phase.</p>
      </div>
      <ComingSoon title={title} />
    </div>
  );
}
