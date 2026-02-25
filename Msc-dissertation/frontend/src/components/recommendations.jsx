import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Recommendations() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/recommendations", { credentials: "include" })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData({ remediate: [], level_up: [], role_based: [] }));
  }, []);

  if (!data) return <div className="text-sm text-gray-500 p-4">Loading recommendations…</div>;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <RecCard title="🎯 Practice your weak spots" items={data.remediate} />
      <RecCard title="🚀 Continue where you left off" items={data.level_up} />
    </div>
  );
}

function RecCard({ title, items }) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
      <h3 className="font-semibold text-lg text-gray-800 mb-4">{title}</h3>
      {!items?.length ? (
        <p className="text-sm text-gray-500">No suggestions yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{it.lesson_title || it.course_name}</div>
                {it.course_name && <div className="text-xs text-gray-600 mt-1">{it.course_name}</div>}
              </div>
              <Link
                to={`/viewer/${it.course_slug}`}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap ml-4 px-3 py-1.5 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}