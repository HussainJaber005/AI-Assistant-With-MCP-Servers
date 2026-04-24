import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader } from "./Loader";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader fullscreen label="Loading session..." />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader fullscreen label="Loading session..." />;
  if (user) return <Navigate to="/" replace />;
  return children;
}
