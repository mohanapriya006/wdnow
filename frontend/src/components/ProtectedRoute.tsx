import { Navigate } from "react-router-dom";
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

  if (isInitializing) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role-based route protection: a contractor can never render vendor pages
  // and vice-versa, regardless of what URL they type.
  if (user?.role !== allowedRole) {
    const fallback = user?.role === "VENDOR" ? "/vendor/dashboard" : "/contractor/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return <AppShell>{children}</AppShell>;
}
