"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie,
} from "recharts";

type Props = {
  funnelData: { name: string; count: number; fill: string }[];
  statusBreakdown: {
    status: string;
    label: string;
    count: number;
    fill: string;
  }[];
  recentActivity: { month: string; applications: number }[];
};

// Custom tooltip styling for dark theme
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-zinc-200">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || "#a78bfa" }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

export function AnalyticsCharts({
  funnelData,
  statusBreakdown,
  recentActivity,
}: Props) {
  const totalForPie = statusBreakdown.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Pipeline Funnel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Application Pipeline
        </h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Progression from Applied → Offer
        </p>

        {funnelData.every((d) => d.count === 0) ? (
          <div className="flex h-56 items-center justify-center text-sm text-zinc-400">
            No application data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={funnelData}
              margin={{ top: 8, right: 8, bottom: 8, left: -16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Applications">
                {funnelData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Status Distribution Pie */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Status Distribution
        </h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          All applications by current status
        </p>

        {totalForPie === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-zinc-400">
            No application data yet
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={240}>
              <PieChart>
                <Pie
                  data={statusBreakdown.filter((s) => s.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {statusBreakdown
                    .filter((s) => s.count > 0)
                    .map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-1 flex-col gap-2">
              {statusBreakdown.map((s) => (
                <div key={s.status} className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.fill }}
                  />
                  <span className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {s.label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activity Over Time */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Application Activity
        </h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Applications created over the last 6 months
        </p>

        {recentActivity.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            No recent activity
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={recentActivity}
              margin={{ top: 8, right: 8, bottom: 8, left: -16 }}
            >
              <defs>
                <linearGradient
                  id="activityGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="applications"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#activityGradient)"
                name="Applications"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
