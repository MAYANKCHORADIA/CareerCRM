import prisma from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";
import { AnalyticsCharts } from "./components/AnalyticsCharts";

export const metadata: Metadata = {
  title: "Analytics — CareerCRM",
  description: "Visualize your job application pipeline and track your success rate.",
};

export const dynamic = "force-dynamic";

const STATUS_ORDER = [
  "SAVED",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export default async function AnalyticsPage() {
  let stats = {
    total: 0,
    interviews: 0,
    offers: 0,
    successRate: 0,
    funnelData: [] as { name: string; count: number; fill: string }[],
    statusBreakdown: [] as { status: string; label: string; count: number; fill: string }[],
    recentActivity: [] as { month: string; applications: number }[],
  };

  let connectionError = false;

  const FUNNEL_COLORS: Record<string, string> = {
    APPLIED: "#3b82f6",
    ASSESSMENT: "#f59e0b",
    INTERVIEW: "#8b5cf6",
    OFFER: "#10b981",
  };

  const STATUS_COLORS: Record<string, string> = {
    SAVED: "#64748b",
    APPLIED: "#3b82f6",
    ASSESSMENT: "#f59e0b",
    INTERVIEW: "#8b5cf6",
    OFFER: "#10b981",
    REJECTED: "#ef4444",
  };

  try {
    // Aggregate counts per status
    const groupedRaw = await prisma.application.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const grouped = groupedRaw as unknown as { status: string; _count: { id: number } }[];

    const countByStatus: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      countByStatus[g.status] = g._count.id;
      total += g._count.id;
    }

    const interviews = countByStatus["INTERVIEW"] || 0;
    const offers = countByStatus["OFFER"] || 0;
    const successRate = total > 0 ? Math.round((offers / total) * 100) : 0;

    // Funnel data (Applied → Assessment → Interview → Offer)
    const funnelStatuses = ["APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER"];
    const funnelData = funnelStatuses.map((status) => ({
      name: STATUS_LABELS[status],
      count: countByStatus[status] || 0,
      fill: FUNNEL_COLORS[status],
    }));

    // Full status breakdown
    const statusBreakdown = STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: countByStatus[status] || 0,
      fill: STATUS_COLORS[status],
    }));

    // Recent activity by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentApps = await prisma.application.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const monthCounts: Record<string, number> = {};
    for (const app of recentApps) {
      const key = app.createdAt.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }

    const recentActivity = Object.entries(monthCounts).map(([month, applications]) => ({
      month,
      applications,
    }));

    stats = {
      total,
      interviews,
      offers,
      successRate,
      funnelData,
      statusBreakdown,
      recentActivity,
    };
  } catch (error) {
    console.error("Analytics DB error:", error);
    connectionError = true;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/20">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 group-hover:text-violet-500 transition-colors">
                  CareerCRM
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Analytics</p>
              </div>
            </Link>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Board
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6">
        {connectionError ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
              <h2 className="mb-2 text-lg font-bold text-rose-900 dark:text-rose-100">Database Connection Failed</h2>
              <p className="text-sm text-rose-700 dark:text-rose-300">
                Could not load analytics data. Please check your database connection.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                label="Total Applications"
                value={stats.total}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
                  </svg>
                }
                accentFrom="from-blue-500"
                accentTo="to-cyan-400"
              />
              <KPICard
                label="Interviews Secured"
                value={stats.interviews}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                }
                accentFrom="from-violet-500"
                accentTo="to-purple-400"
              />
              <KPICard
                label="Offers Received"
                value={stats.offers}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z" />
                  </svg>
                }
                accentFrom="from-emerald-500"
                accentTo="to-green-400"
              />
              <KPICard
                label="Success Rate"
                value={`${stats.successRate}%`}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                }
                accentFrom="from-amber-500"
                accentTo="to-orange-400"
              />
            </div>

            {/* Charts */}
            <AnalyticsCharts
              funnelData={stats.funnelData}
              statusBreakdown={stats.statusBreakdown}
              recentActivity={stats.recentActivity}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── KPI Card Component ──────────────────────────────────────────────

function KPICard({
  label,
  value,
  icon,
  accentFrom,
  accentTo,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accentFrom: string;
  accentTo: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentFrom} ${accentTo}`} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {value}
          </p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accentFrom} ${accentTo} text-white shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
