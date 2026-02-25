import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Menu as MenuIcon,
  X as CloseIcon,
  User as UserIcon,
  LogOut as LogoutIcon,
  Settings as SettingsIcon,
  BookOpen,
  Home,
  LayoutDashboard,
  Info, // ⬅️ NEW
} from "lucide-react";

export default function Navbar() {
  const [me, setMe] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me", { credentials: "include" });
        const d = await r.json();
        setMe(d.user || null);
      } catch {
        setMe(null);
      }
    })();
    setMobileOpen(false);
    setUserOpen(false);
  }, [loc.pathname]);

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    setMe(null);
    navigate("/login");
  }

  const navLinkClass =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100";
  const activeClass =
    "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200";

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Left: Brand + Mobile toggle */}
        <div className="flex items-center gap-2">
          <button
            className="mr-1 rounded-lg p-2 hover:bg-slate-100 md:hidden"
            aria-label="Toggle Menu"
            onClick={() => setMobileOpen((s) => !s)}
          >
            {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-slate-900">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white">
              🏥
            </span>
            <span>MediLearn</span>
          </Link>
        </div>

        {/* Center: Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${navLinkClass} ${isActive ? activeClass : "text-slate-700"}`
            }
          >
            <Home className="h-4 w-4" /> Home
          </NavLink>

          <NavLink
            to="/courses"
            className={({ isActive }) =>
              `${navLinkClass} ${isActive ? activeClass : "text-slate-700"}`
            }
          >
            <BookOpen className="h-4 w-4" /> Courses
          </NavLink>

          {/* About / How it works with icon */}
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `${navLinkClass} ${isActive ? activeClass : "text-slate-700"}`
            }
          >
            <Info className="h-4 w-4" /> How it works
          </NavLink>

          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              `${navLinkClass} ${isActive ? activeClass : "text-slate-700"}`
            }
          >
            <LayoutDashboard className="h-4 w-4" /> LeaderBoard
          </NavLink>

          {me?.role === "admin" && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `${navLinkClass} ${isActive ? activeClass : "text-slate-700"}`
              }
            >
              <LayoutDashboard className="h-4 w-4" /> Admin
            </NavLink>
          )}
        </div>

        {/* Right: Auth / Profile */}
        <div className="flex items-center gap-2">
          {!me ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setUserOpen((s) => !s)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                aria-haspopup="menu"
                aria-expanded={userOpen}
              >
                <UserIcon className="h-4 w-4" />
                <span className="max-w-[140px] truncate">{me.name || me.email || "Me"}</span>
              </button>

              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => setUserOpen(false)}
                  >
                    <UserIcon className="h-4 w-4" /> My Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => setUserOpen(false)}
                  >
                    <SettingsIcon className="h-4 w-4" /> Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <LogoutIcon className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t bg-white md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <div className="flex flex-col gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? activeClass : "text-slate-700 hover:bg-slate-100"
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                Home
              </NavLink>

              <NavLink
                to="/courses"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? activeClass : "text-slate-700 hover:bg-slate-100"
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                Courses
              </NavLink>

              {/* About / How it works with icon (mobile) */}
              <NavLink
                to="/about"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? activeClass : "text-slate-700 hover:bg-slate-100"
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Info className="h-4 w-4" /> How it works
                </span>
              </NavLink>

              {/* Leaderboard */}
              <NavLink
                to="/leaderboard"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? activeClass : "text-slate-700 hover:bg-slate-100"
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                LeaderBoard
              </NavLink>

              {me?.role === "admin" && (
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive ? activeClass : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  Admin
                </NavLink>
              )}

              {!me ? (
                <div className="mt-2 flex gap-2">
                  <Link
                    to="/login"
                    className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => setMobileOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    to="/profile"
                    className="rounded-lg px-3 py-2 text-center text-sm font-medium hover:bg-slate-100"
                    onClick={() => setMobileOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="rounded-lg px-3 py-2 text-center text-sm font-medium hover:bg-slate-100"
                    onClick={() => setMobileOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="col-span-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
