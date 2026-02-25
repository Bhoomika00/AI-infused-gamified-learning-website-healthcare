import React, { useEffect, useState } from "react";

export default function FurtherReading({ topic, compact=false }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!topic) return;
    let mounted = true;
    (async () => {
      const r = await fetch(`/api/resources?query=${encodeURIComponent(topic)}&limit=6`, { credentials:"include" });
      const data = await r.json().catch(()=>[]);
      if (mounted) setItems(Array.isArray(data) ? data : []);
    })();
    return () => (mounted=false);
  }, [topic]);

  if (!items.length) return null;

  return (
    <div className={`bg-white rounded-xl shadow ${compact ? "p-4" : "p-6"}`}>
      <h4 className="font-semibold mb-3">🔗 Further Reading (trusted sources)</h4>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            <a className="text-blue-600 hover:underline" href={it.url} target="_blank" rel="noreferrer">
              {it.title || it.url}
            </a>
            {it.source && <span className="ml-2 text-xs text-gray-500">({it.source})</span>}
            {it.snippet && <p className="text-gray-600 text-xs mt-1 line-clamp-2">{it.snippet}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
