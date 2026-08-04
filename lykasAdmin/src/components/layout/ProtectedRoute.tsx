import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/auth";
import { LoadingState } from "../ui/StateDisplays";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
}

/**
 * Gates a route behind an authenticated staff session, and optionally a
 * specific role subset (§7.1 — role-gated navigation and route guards).
 * super_admin always passes any role check (mirrors the backend's
 * wildcard convention).
 */
export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Checking your session…" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold text-gray-900">Not authorized</p>
        <p className="text-sm text-gray-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
