import React from "react";
import { BarChart3, IndianRupee } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export interface SevenDayAttendancePoint {
  dateStr: string;
  dayLabel: string;
  presentPct: number;
  presentCount: number;
  absentCount: number;
  isToday?: boolean;
}

export interface SevenDayFeePoint {
  dateStr: string;
  dayLabel: string;
  amount: number;
  isToday?: boolean;
}

interface AdminDashboardChartsProps {
  sevenDayAttendanceData: SevenDayAttendancePoint[];
  avgAttendancePct: number;
  sevenDayFeeData: SevenDayFeePoint[];
  monthlyProgressPct: number;
  currentMonthCollection: number;
  onlineQrTotal: number;
  nstaOnlineTotal: number;
  cashTotal: number;
  appTheme: "white" | "black" | "current";
  onOpenAttendance: () => void;
  onOpenFees: () => void;
}

export const AdminDashboardCharts: React.FC<AdminDashboardChartsProps> = ({
  sevenDayAttendanceData,
  avgAttendancePct,
  sevenDayFeeData,
  monthlyProgressPct,
  currentMonthCollection,
  onlineQrTotal,
  nstaOnlineTotal,
  cashTotal,
  appTheme,
  onOpenAttendance,
  onOpenFees,
}) => {
  const isWhite = appTheme === "white";
  const gridStroke = isWhite ? "#e2e8f0" : "rgba(148, 163, 184, 0.14)";
  const tickColor = isWhite ? "#64748b" : "#94a3b8";

  const attChartData = sevenDayAttendanceData.map((d) => ({
    ...d,
    label: d.isToday ? "आज" : d.dayLabel,
  }));

  const feeChartData = sevenDayFeeData.map((f) => ({
    ...f,
    label: f.isToday ? "आज" : f.dayLabel,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      {/* 7-Day Attendance Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-300 border border-teal-200/70 dark:border-teal-800/60 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                7-Day Student Attendance
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                दैनिक उपस्थिति प्रतिशत (%)
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50 tabular-nums">
            Avg: {avgAttendancePct}%
          </span>
        </div>

        <div className="mt-3 h-40 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attChartData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: isWhite ? "rgba(241,245,249,0.7)" : "rgba(30,41,59,0.45)" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as SevenDayAttendancePoint & { label: string };
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-lg text-xs">
                      <p className="font-bold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                        {item.presentPct}% उपस्थित ({item.presentCount} P / {item.absentCount} A)
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="presentPct" radius={[6, 6, 0, 0]} maxBarSize={28}>
                {attChartData.map((entry, idx) => (
                  <Cell
                    key={`att-cell-${entry.dateStr}-${idx}`}
                    fill={
                      entry.isToday
                        ? "#0d9488"
                        : entry.presentPct >= 90
                        ? "#10b981"
                        : "#3b82f6"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
            आज उपस्थित: <strong className="text-emerald-600 dark:text-emerald-400">{sevenDayAttendanceData[6]?.presentCount ?? 0}</strong> · अनुपस्थित:{" "}
            <strong className="text-rose-600 dark:text-rose-400">{sevenDayAttendanceData[6]?.absentCount ?? 0}</strong>
          </span>
          <button
            type="button"
            onClick={onOpenAttendance}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
          >
            हाजिरी देखें →
          </button>
        </div>
      </div>

      {/* 7-Day Fee Collection Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                7-Day Fee Collection
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                दैनिक शुल्क व स्टोर संग्रह
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50 tabular-nums">
            Target: {monthlyProgressPct}%
          </span>
        </div>

        <div className="mt-3 h-40 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={feeChartData} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 10 }}
                tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
              />
              <Tooltip
                cursor={{ fill: isWhite ? "rgba(241,245,249,0.7)" : "rgba(30,41,59,0.45)" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as SevenDayFeePoint & { label: string };
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-lg text-xs">
                      <p className="font-bold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-indigo-600 dark:text-indigo-400 font-semibold tabular-nums font-mono">
                        ₹{Number(item.amount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={28}>
                {feeChartData.map((entry, idx) => (
                  <Cell
                    key={`fee-cell-${entry.dateStr}-${idx}`}
                    fill={entry.isToday ? "#10b981" : "#6366f1"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
          <div className="flex items-center gap-2.5 flex-wrap tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">
              माह कुल: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">₹{currentMonthCollection.toLocaleString("en-IN")}</strong>
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold font-mono">
              QR ₹{onlineQrTotal.toLocaleString("en-IN")}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
              Online ₹{nstaOnlineTotal.toLocaleString("en-IN")}
            </span>
            <span className="text-slate-600 dark:text-slate-300 font-semibold font-mono">
              Cash ₹{cashTotal.toLocaleString("en-IN")}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenFees}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
          >
            फीस काउंटर →
          </button>
        </div>
      </div>
    </div>
  );
};
