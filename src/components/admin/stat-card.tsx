interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  delay?: number;
}

/** A single real figure on the admin dashboard / reports overview. */
export function StatCard({ label, value, hint, delay = 0 }: StatCardProps) {
  return (
    <div
      className="animate-slide-in rounded-2xl border border-[color:var(--border)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-[color:var(--background)] hover:shadow-md motion-reduce:transform-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
