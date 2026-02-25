// src/main.jsx (or wherever you bootstrap React Router)
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Layout from "./components/layout";        // global layout with Navbar
import Landing from "./pages/landing";
import Courses from "./pages/courses";
import LessonViewer from "./pages/lessonViewer";
import Signup from "./pages/Signup";
import Modules from "./pages/modules";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Chatbot from "./components/chatbot";  
import Onboarding from "./pages/onboarding";    // ⬅️ add the chatbot
import "./index.css";
import Leaderboard from "./components/leaderboard";

/* ---------- tiny auth helpers ---------- */
function useMe() {
  const [me, setMe] = useState({ loading: true, user: null });
  useEffect(() => {
    let mounted = true;
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => mounted && setMe({ loading: false, user: d.user || null }))
      .catch(() => mounted && setMe({ loading: false, user: null }));
    return () => { mounted = false; };
  }, []);
  return me;
}

function RequireAuth({ children }) {
  const { loading, user } = useMe();
  const loc = useLocation();
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { loading, user } = useMe();
  const loc = useLocation();
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

/* ---------- tiny helper to mount chatbot site-wide ---------- */
function ChatbotMount() {
  const loc = useLocation();
  // If the path is /viewer/:slug, pass that slug to the chatbot for better grounding
  const match = loc.pathname.match(/^\/viewer\/([^/?#]+)/);
  const courseSlug = match ? decodeURIComponent(match[1]) : "";
  return <Chatbot courseSlug={courseSlug} />;
}

/* ---------- app routes ---------- */
function AppRoutes() {
  return (
    <Layout>
      <Routes>
        {/* public */}
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<Onboarding />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/viewer/:slug" element={<LessonViewer />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        {/* modules listing for a course */}
        <Route path="/modules/:slug" element={<Modules />} />

        {/* protected (admin) */}
        <Route
          path="/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* floating chatbot lives outside <Routes> so it persists across pages */}
      <ChatbotMount />
    </Layout>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
