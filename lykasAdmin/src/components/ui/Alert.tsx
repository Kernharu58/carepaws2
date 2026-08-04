import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

interface AlertProps {
  tone: "success" | "warning" | "danger" | "info";
  children: ReactNode;
}

const CONFIG = {
  success: { icon: CheckCircle2, classes: "bg-status-successBg text-status-success border-status-success/20" },
  warning: { icon: AlertTriangle, classes: "bg-status-warningBg text-status-warning border-status-warning/20" },
  danger: { icon: XCircle, classes: "bg-status-dangerBg text-status-danger border-status-danger/20" },
  info: { icon: Info, classes: "bg-blue-50 text-blue-700 border-blue-200" },
};

export default function Alert({ tone, children }: AlertProps) {
  const { icon: Icon, classes } = CONFIG[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${classes}`} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
