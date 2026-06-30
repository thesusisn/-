import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/" className="brand">
          StreamFlix
        </Link>
        <Link to="/">Browse</Link>
        <Link to="/live">Live</Link>
        {user && <Link to="/upload">Upload</Link>}
      </div>
      <div className="navbar-right">
        {user ? (
          <>
            <Link to="/dashboard">{user.username}</Link>
            <button className="link-button" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="cta">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
