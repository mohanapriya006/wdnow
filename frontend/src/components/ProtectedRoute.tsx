import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/api/types";
import { AppShell } from "@/components/layout/AppShell";
import { PageLoader } from "@/components/ui/Feedback";

export function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: ReactNode;
  allowedRole: UserRole;
}) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    // Carry the attempted page so signing in returns here rather than dumping
    // the user on a dashboard they did not ask for.
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  // Role-based route protection: a contractor can never render vendor pages
  // and vice-versa, regardless of what URL they type.
  if (user?.role !== allowedRole) {
    const fallback = user?.role === "VENDOR" ? "/vendor/dashboard" : "/contractor/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return <AppShell>{children}</AppShell>;
}
