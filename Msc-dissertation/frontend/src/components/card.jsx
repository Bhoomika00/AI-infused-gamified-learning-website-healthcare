import React from "react";

export function Card({ className = "", ...props }) {
  return (
    <div
      className={[
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }) {
  return <div className={["p-6 pb-0", className].join(" ")} {...props} />;
}

export function CardTitle({ className = "", ...props }) {
  return (
    <h3
      className={["text-xl font-semibold leading-none tracking-tight", className].join(" ")}
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }) {
  return <div className={["p-6 pt-4", className].join(" ")} {...props} />;
}
