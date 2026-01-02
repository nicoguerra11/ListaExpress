import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) return null; // después le metemos un loader bonito
  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
