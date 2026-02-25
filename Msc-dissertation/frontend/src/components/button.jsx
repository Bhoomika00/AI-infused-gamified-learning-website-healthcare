import React from "react";

const VARIANTS = {
  default: "bg-indigo-600 text-white hover:bg-indigo-700",
  outline: "border border-slate-300 text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
};
const SIZES = { sm: "h-9 px-3", md: "h-10 px-4", lg: "h-11 px-5" };

export function Button({ variant = "default", size = "md", className = "", ...props }) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-lg font-medium transition",
        VARIANTS[variant] || VARIANTS.default,
        SIZES[size] || SIZES.md,
        className,
      ].join(" ")}
      {...props}
    />
  );
}
