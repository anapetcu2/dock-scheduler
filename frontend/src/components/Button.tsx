import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand-gradient text-white shadow-glow hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:shadow-none",
  secondary:
    "bg-surface-800 text-slate-200 border border-surface-600 hover:bg-surface-700 hover:border-surface-500 disabled:opacity-40",
  danger:
    "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 disabled:opacity-40",
  ghost: "text-slate-300 hover:bg-surface-800 hover:text-white disabled:opacity-40",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`transition-default inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
