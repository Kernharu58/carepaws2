import type { TextareaHTMLAttributes } from "react";

export default function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
        focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${props.className ?? ""}`}
    />
  );
}
