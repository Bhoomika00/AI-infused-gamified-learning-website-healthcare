import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", accountType: "user" });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));
  const isUser = form.accountType === "user";
  const canSubmit = form.email.trim() && form.password;

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) {
          if (d.user.role === "admin") navigate("/dashboard");
          else navigate("/courses");
        }
      }).catch(() => {});
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setStatus(""); setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.accountType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("✅ Logged in!");
        if (data.user?.role === "admin") navigate("/dashboard");
        else navigate("/courses");
      } else {
        setStatus(data.error || "❌ Invalid credentials.");
      }
    } catch (e) {
      console.error(e);
      setStatus("❌ Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 px-4">
      <form onSubmit={submit} className="bg-white w-full max-w-lg rounded-2xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">Welcome back</h2>

        <div className="mb-5">
          <div className="flex rounded-xl overflow-hidden border">
            <button type="button" onClick={() => update("accountType", "user")}
              className={`w-1/2 py-2 font-semibold ${isUser ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>
              User
            </button>
            <button type="button" onClick={() => update("accountType", "admin")}
              className={`w-1/2 py-2 font-semibold ${!isUser ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>
              Admin
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isUser ? "Log in to access your courses." : "Admins can upload PDFs and manage courses."}
          </p>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => update("email", e.target.value)}
                 className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500" required/>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input type="password" value={form.password} onChange={e => update("password", e.target.value)}
                 className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500" required/>
        </div>

        <button type="submit" disabled={!canSubmit || loading}
                className={`w-full py-2.5 rounded-lg font-semibold transition ${
                  !canSubmit || loading ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                        : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          {loading ? "Signing in..." : "Log In"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-700">
          Don’t have an account? <Link to="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>

        {status && <p className="mt-4 text-center text-sm text-gray-700">{status}</p>}
      </form>
    </div>
  );
}
