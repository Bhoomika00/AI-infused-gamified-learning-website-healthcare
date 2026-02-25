import React, { useEffect, useMemo, useState } from "react";

export default function Leaderboard({ preview = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/leaderboard", { credentials: "include" });
        const data = await r.json();
        if (!mounted) return;
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const top = useMemo(() => (preview ? rows.slice(0, 5) : rows), [rows, preview]);

  if (loading) return <div className="text-sm text-gray-500">Loading leaderboard…</div>;
  if (!top.length) return <div className="text-sm text-gray-500">No players yet.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">🏆 Leaderboard</h3>
        {!preview && (
          <span className="text-xs text-gray-500">{rows.length} players</span>
        )}
      </div>

      {/* podium for top 3 */}
      {!preview && rows.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {rows.slice(0, 3).map((u, i) => (
            <div
              key={u.id}
              className={`rounded-xl p-4 text-center border ${
                i === 0
                  ? "bg-yellow-50 border-yellow-300"
                  : i === 1
                  ? "bg-gray-50 border-gray-300"
                  : "bg-amber-50 border-amber-300"
              }`}
            >
              <div className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
              <Avatar name={u.name} />
              <div className="mt-2 font-semibold">{u.name}</div>
              <div className="text-xs text-gray-600">{u.job_title || "Player"}</div>
              <div className="mt-2 text-sm font-bold text-blue-600">
                {u.total_xp || u.xp || 0} XP
              </div>
              <XPBar xp={u.total_xp || u.xp || 0} compact />
            </div>
          ))}
        </div>
      )}

      {/* list */}
      <ul className="space-y-2">
        {top.map((u, idx) => (
          <li
            key={u.id ?? idx}
            className="flex items-center justify-between bg-gradient-to-r from-white to-indigo-50 border rounded-xl p-3"
          >
            <div className="flex items-center gap-3">
              <RankBadge rank={idx + 1} />
              <Avatar name={u.name} />
              <div>
                <div className="font-medium leading-tight">{u.name}</div>
                <div className="text-xs text-gray-600">{u.job_title || "Player"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold text-blue-600">
                {u.total_xp || u.xp || 0} XP
              </div>
              <XPBar xp={u.total_xp || u.xp || 0} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankBadge({ rank }) {
  const color =
    rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-gray-300" : rank === 3 ? "bg-amber-500" : "bg-indigo-300";
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${color}`}>
      {rank}
    </span>
  );
}

function Avatar({ name = "" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm shadow">
      {initials || "?"}
    </div>
  );
}

function XPBar({ xp = 0, compact = false }) {
  const XP_PER_LEVEL = 1000; // Changed from 100 to 1000
  const lvl = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
  const xpInCurrentLevel = xp % XP_PER_LEVEL;
  const pct = Math.min(100, Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100));

  return (
    <div className={`flex items-center gap-2 ${compact ? "w-full" : "w-56"}`}>
      <div className="text-xs font-semibold w-10 text-right">Lv {lvl}</div>
      <div className="flex-1">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-600" style={{ width: `${pct}%` }} />
        </div>
        {!compact && (
          <div className="text-[10px] text-gray-600 mt-0.5">{xpInCurrentLevel} / {XP_PER_LEVEL} XP</div>
        )}
      </div>
    </div>
  );
}