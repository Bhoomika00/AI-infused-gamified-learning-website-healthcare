import React from "react";

export function Progress({ value = 0, className = "" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className={["relative w-full overflow-hidden rounded-full bg-slate-200", className].join(" ")}
    >
      <div
        className="h-full bg-indigo-600 transition-[width] duration-300"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
