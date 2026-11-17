export default function MetricCard({ label, value = "--", caption }) {
  return (
    <article className="surface-card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {caption && <p className="mt-2 text-xs text-slate-500">{caption}</p>}
    </article>
  );
}
