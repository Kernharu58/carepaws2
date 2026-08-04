import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  error,
  children,
  ...rest
}: { label: string; htmlFor: string; error?: string; children: ReactNode } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700" {...rest}>
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
        focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
        focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${props.className ?? ""}`}
    />
  );
}
