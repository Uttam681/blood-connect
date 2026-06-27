import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-bold text-brand">
          BloodConnect
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                to="/donors"
                className="text-gray-600 hover:text-brand text-sm font-medium"
              >
                Find Donors
              </Link>
              <Link
                to={user.role === "admin" ? "/admin" : "/dashboard"}
                className="text-gray-600 hover:text-brand text-sm font-medium"
              >
                {user.role === "admin" ? "Admin" : "Dashboard"}
              </Link>
              <span className="text-sm text-gray-500 hidden sm:inline">
                {user.name} ({user.role})
              </span>
              <button
                onClick={handleLogout}
                className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/donors"
                className="text-gray-600 hover:text-brand text-sm font-medium"
              >
                Find Donors
              </Link>
              <Link
                to="/login"
                className="text-gray-600 hover:text-brand text-sm font-medium"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark transition"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
