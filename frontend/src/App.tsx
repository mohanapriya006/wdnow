import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { NotFound } from "@/pages/NotFound";
import { ComingSoonPage } from "@/pages/ComingSoonPage";

import { VendorDashboard } from "@/pages/vendor/VendorDashboard";
import { VendorProfile } from "@/pages/vendor/VendorProfile";
import { VendorContractors } from "@/pages/vendor/VendorContractors";
import { VendorContractorDetail } from "@/pages/vendor/VendorContractorDetail";
import { VendorAssignments } from "@/pages/vendor/VendorAssignments";
import { VendorAssignmentNew } from "@/pages/vendor/VendorAssignmentNew";
import { VendorAssignmentDetail } from "@/pages/vendor/VendorAssignmentDetail";

import { ContractorDashboard } from "@/pages/contractor/ContractorDashboard";
import { ContractorProfile } from "@/pages/contractor/ContractorProfile";
import { ContractorAssignment } from "@/pages/contractor/ContractorAssignment";
import { PageLoader } from "@/components/ui/Feedback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function RootRedirect() {
  const { user, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <Navigate to={user?.role === "VENDOR" ? "/vendor/dashboard" : "/contractor/dashboard"} replace />
  );
}

function LoginRoute() {
  const { isAuthenticated, user, isInitializing } = useAuth();
  if (isInitializing) return <PageLoader />;
  if (isAuthenticated) {
    return (
      <Navigate to={user?.role === "VENDOR" ? "/vendor/dashboard" : "/contractor/dashboard"} replace />
    );
  }
  return <LoginPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginRoute />} />

      {/* Vendor routes */}
      <Route
        path="/vendor/dashboard"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <VendorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/profile"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <VendorProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/contractors"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <VendorContractors />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/contractors/:id"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <VendorContractorDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/assignments"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <VendorAssignments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/assignments/new"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <VendorAssignmentNew />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/assignments/:id"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <VendorAssignmentDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/timesheets"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <ComingSoonPage title="Timesheets" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/milestones"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <ComingSoonPage title="Milestones" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/invoices"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <ComingSoonPage title="Invoices" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor/payroll"
        element={
          <ProtectedRoute allowedRole="VENDOR">
            <ComingSoonPage title="Payroll" />
          </ProtectedRoute>
        }
      />

      {/* Contractor routes */}
      <Route
        path="/contractor/dashboard"
        element={
          <ProtectedRoute allowedRole="CONTRACTOR">
            <ContractorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contractor/profile"
        element={
          <ProtectedRoute allowedRole="CONTRACTOR">
            <ContractorProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contractor/assignment"
        element={
          <ProtectedRoute allowedRole="CONTRACTOR">
            <ContractorAssignment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contractor/timesheets"
        element={
          <ProtectedRoute allowedRole="CONTRACTOR">
            <ComingSoonPage title="Timesheets" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contractor/expenses"
        element={
          <ProtectedRoute allowedRole="CONTRACTOR">
            <ComingSoonPage title="Expenses" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contractor/milestones"
        element={
          <ProtectedRoute allowedRole="CONTRACTOR">
            <ComingSoonPage title="Milestones" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contractor/payroll"
        element={
          <ProtectedRoute allowedRole="CONTRACTOR">
            <ComingSoonPage title="Payroll" />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
