import React, { useEffect, useState } from "react";

export default function BadgesShelf() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    fetch("/api/me/badges", { credentials: "include" })
      .then(r => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  if (!rows.length) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">🏅 Your Badges</h3>
      <div className="flex gap-4 flex-wrap">
        {rows.map((b, i) => (
          <div key={i} className="text-center">
            <img src={`/images/${b.icon || "badge.png"}`} alt={b.name} className="h-12 mx-auto" />
            <p className="text-xs mt-1">{b.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
