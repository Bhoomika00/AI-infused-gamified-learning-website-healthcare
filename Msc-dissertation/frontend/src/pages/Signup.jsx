import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const ROLES = [
  { value: "nurse", label: "Nurse" },
  { value: "cleaner", label: "Cleaner" },
  { value: "catering", label: "Catering Staff" },
  { value: "porter", label: "Porter" },
  { value: "domestic", label: "Domestic/Housekeeping" },
];

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    accountType: "user", // 'user' | 'admin'
    job_title: "nurse",
  });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (f, v) => setForm((prev) => ({ ...prev, [f]: v }));
  const isUser = form.accountType === "user";
  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.password &&
    (isUser ? form.job_title : true);

  const submit = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.accountType, // 'user' | 'admin'
        job_title: isUser ? form.job_title : null,
      };

      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus(data.message || "✅ Registered! Redirecting to login…");
        // Redirect to login after a short pause so the message is visible
        setTimeout(() => navigate("/login", { replace: true }), 900);
      } else {
        setStatus(data.error || "❌ Failed to register.");
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
        <h2 className="text-2xl font-bold text-center mb-6">Create an account</h2>

        {/* Account type toggle */}
        <div className="mb-5">
          <div className="flex rounded-xl overflow-hidden border">
            <button
              type="button"
              onClick={() => update("accountType", "user")}
              className={`w-1/2 py-2 font-semibold ${
                isUser ? "bg-blue-600 text-white" : "bg-white text-gray-700"
              }`}
            >
              User
            </button>
            <button
              type="button"
              onClick={() => update("accountType", "admin")}
              className={`w-1/2 py-2 font-semibold ${
                !isUser ? "bg-blue-600 text-white" : "bg-white text-gray-700"
              }`}
            >
              Admin
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isUser
              ? "Select your role to tailor courses."
              : "Admins can upload PDFs and manage courses."}
          </p>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            required
          />
        </div>

        {isUser && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select your role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const active = form.job_title === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => update("job_title", r.value)}
                    className={`text-sm border rounded-lg px-3 py-2 text-left transition ${
                      active
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "bg-white hover:border-blue-300"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className={`w-full py-2.5 rounded-lg font-semibold transition ${
            !canSubmit || loading
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {loading ? "Submitting..." : "Register"}
        </button>

        {status && <p className="mt-4 text-center text-sm text-gray-700">{status}</p>}

        <p className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-700 underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
