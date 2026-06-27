import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function OAuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const name = params.get("name");
    const role = params.get("role");
    const isNew = params.get("isNew") === "1";

    if (!token) {
      navigate("/login?error=google_failed");
      return;
    }

    loginWithToken(token, { name, role });
    navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen text-gray-500 text-sm">
      Signing you in...
    </div>
  );
}
