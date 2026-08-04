import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from "react-error-boundary";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./ui/Button";
import { api } from "../services/api";

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-status-danger" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-gray-900">Something went wrong on this page</h2>
      <p className="max-w-md text-sm text-gray-500">
        {error instanceof Error ? error.message : "An unexpected error occurred."}
      </p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

/**
 * Wraps routed pages so a bad admin action surfaces a recoverable error
 * screen instead of a blank tab (§7.1 production addition — react-error-
 * boundary around routed pages). Also reports to /api/errors so it shows
 * up in the admin panel's own ErrorLog view even without a Sentry seat.
 */
export default function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={Fallback}
      onError={(error, info) => {
        api
          .post("/api/errors/report", {
            source: "admin",
            message: error.message,
            stack: error.stack,
            route: window.location.pathname,
            severity: "error",
            metadata: { componentStack: info.componentStack },
          })
          .catch(() => {
            // Reporting the error must never itself throw and mask the
            // original failure.
          });
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
