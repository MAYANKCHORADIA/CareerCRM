import prisma from "@/lib/prisma";
import Link from "next/link";
import { KanbanBoard } from "./components/KanbanBoard";
import type { ApplicationCard } from "./types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let applications: any[] = [];
  let connectionError = false;

  try {
    applications = await prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        timelineEvents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    console.error("Failed to connect to database:", error);
    connectionError = true;
  }

  // Serialize dates for client component
  const serializedApps: ApplicationCard[] = applications.map((app) => ({
    id: app.id,
    companyName: app.companyName,
    roleTitle: app.roleTitle,
    status: app.status,
    appliedDate: app.appliedDate?.toISOString() ?? null,
    notes: app.notes,
    createdAt: app.createdAt.toISOString(),
    timelineEvents: app.timelineEvents.map((te: any) => ({
      id: te.id,
      content: te.content,
      createdAt: te.createdAt.toISOString(),
    })),
  }));

  const totalApps = applications.length;
  const activeApps = applications.filter(
    (a) => !["SAVED", "REJECTED"].includes(a.status)
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/20">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                CareerCRM
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Application Tracker
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-4 md:flex">
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  Total
                </p>
                <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {totalApps}
                </p>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  Active
                </p>
                <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {activeApps}
                </p>
              </div>
            </div>
            <Link
              href="/analytics"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              📊 Analytics
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-xs font-bold text-white shadow-sm">
              AJ
            </div>
          </div>
        </div>
      </header>

      {/* Board or Error State */}
      <main className="flex flex-1 flex-col overflow-hidden pt-4">
        {connectionError ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-bold text-rose-900 dark:text-rose-100">Database Connection Failed</h2>
              <p className="mb-4 text-sm text-rose-700 dark:text-rose-300">
                It looks like we couldn't connect to your PostgreSQL database at <strong>localhost:5432</strong>.
              </p>
              <div className="rounded-lg bg-white/50 p-4 text-left text-sm text-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
                <p className="mb-2 font-semibold">To fix this issue:</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Ensure PostgreSQL is running locally</li>
                  <li>Check your <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-xs dark:bg-rose-900/50">DATABASE_URL</code> in <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-xs dark:bg-rose-900/50">.env</code></li>
                  <li>Run <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-xs dark:bg-rose-900/50">npm run db:migrate</code></li>
                  <li>Run <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-xs dark:bg-rose-900/50">npm run db:seed</code></li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <KanbanBoard applications={serializedApps} />
        )}
      </main>
    </div>
  );
}
