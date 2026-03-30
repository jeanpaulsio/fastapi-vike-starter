import { useCurrentUser } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const firstName = user?.first_name ?? "there";

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-1 text-xl font-extrabold text-foreground">Welcome, {firstName}</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Your dashboard — add widgets, charts, and summaries here.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Items", value: "\u2014" },
          { label: "Active", value: "\u2014" },
          { label: "Archived", value: "\u2014" },
          { label: "This Week", value: "\u2014" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[10px] border border-border bg-card p-4">
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </div>
            <div className="text-[22px] font-extrabold text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[10px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Connect these stats to your API to bring the dashboard to life.
      </div>
    </div>
  );
}
