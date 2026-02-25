import React, { useEffect, useState } from "react";

export default function WeakAreas({ limit = 5 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/me/topics", { credentials: "include" });
        const data = r.ok ? await r.json() : [];
        if (!live) return;
        const sorted = Array.isArray(data) ? data.sort((a, b) => (a.accuracy - b.accuracy)) : [];
        setRows(sorted.slice(0, limit));
      } catch {
        setRows([]);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [limit]);

  if (loading) return <div className="text-sm text-gray-500">Loading weak areas…</div>;
  if (!rows.length) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h4 className="font-semibold mb-2">🎯 Focus areas</h4>
      <ul className="space-y-1">
        {rows.map((t, i) => (
          <li key={i} className="text-sm flex items-center justify-between">
            <span className="text-gray-700">{t.topic}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700">
              {Math.round((t.accuracy || 0) * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 mt-2">
        These are suggested topics to revisit. Improving any to ≥80% can unlock a badge.
      </p>
    </div>
  );
}
