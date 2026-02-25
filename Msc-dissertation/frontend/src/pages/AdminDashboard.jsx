import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

export default function AdminDashboard() {
  // data
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  // filters for Users (DB-only)
  const [query, setQuery] = useState("");
  const [minXP, setMinXP] = useState("");
  const [selectedJob, setSelectedJob] = useState("all");
  const [sortField, setSortField] = useState("xp");
  const [sortDirection, setSortDirection] = useState("desc");

  // live refresh
  const [autoRefresh, setAutoRefresh] = useState(true);

  // scroll spy
  const [active, setActive] = useState("overview");
  const sections = [
    { id: "overview", label: "Overview", emoji: "📊" },
    { id: "users", label: "Users", emoji: "👥" },
    { id: "analytics", label: "User Analytics", emoji: "📈" },
    { id: "weak", label: "Weak Areas", emoji: "🎯" },
    { id: "upload", label: "Upload PDF", emoji: "📤" },
  ];

  // refs
  const refs = {
    overview: useRef(null),
    users: useRef(null),
    analytics: useRef(null),
    weak: useRef(null),
    upload: useRef(null),
  };

  const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  // hardcoded fallback weak areas (if no recommendations from backend)
  const HARDCODED_WEAK = {
    remediate: [
      {
        course_name: "Developments in General Cleaning Practices",
        lesson_title: "Nhs-Cleaning-Manual-1.0",
        difficulty_score: 0.78,
        users_struggling: "8+",
        course_slug: "developments-in-general-cleaning-practices",
      },
      {
        course_name: "Service Managers in Food Allergen Management",
        lesson_title: "Food-Allergen-Procedure",
        difficulty_score: 0.71,
        users_struggling: "3+",
        course_slug: "service-managers-in-food-allergen-management",
      },
      {
        course_name: "General Fire Safety",
        lesson_title: "Fire Safety Standard Operating Procedure",
        difficulty_score: 0.64,
        users_struggling: "5+",
        course_slug: "general-fire-safety",
      },
      {
        course_name: "General Cleaning Techniques",
        lesson_title: "Nhs-Cleaning-Manual-2.0",
        difficulty_score: 0.69,
        users_struggling: "4+",
        course_slug: "general-cleaning-techniques",
      },
    ],
  };
  //                     -

  // fetchers
  const loadAll = async () => {
    setError("");
    try {
      const [ov, us, an] = await Promise.all([
        fetch("/api/admin/overview", { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/users?role=user", { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/analytics", { credentials: "include" }).then(r => r.json())
      ]);
      setOverview(ov);
      setUsers(Array.isArray(us) ? us : []);
      setAnalytics(an);
    } catch {
      setError("Failed to load admin data.");
    }
    // weak areas (user-specific suggestions, optional)
    fetch("/api/recommendations", { credentials: "include" })
      .then(r => r.json())
      .then(setRecommendations)
      .catch(() => {});
  };

  useEffect(() => {
    loadAll();
  }, []);

  // polling every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadAll, 30000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  // scroll spy
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter(e => e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
        if (vis.length) setActive(vis[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0,0.25,0.5,0.75,1] }
    );
    Object.values(refs).forEach(r => r.current && obs.observe(r.current));
    return () => obs.disconnect();
  }, []);

  // job titles from DB users only
  const jobTitles = useMemo(() => {
    const jobs = [...new Set(users.map(u => u.job_title).filter(Boolean))];
    return jobs.sort();
  }, [users]);

  // filter/sort users
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = parseInt(minXP || "0", 10) || 0;

    let filtered = users.filter((u) => {
      const matchQ =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u.job_title || "").toLowerCase().includes(q);
      const matchXP = (u.xp || 0) >= min;
      const matchJob = selectedJob === "all" || u.job_title === selectedJob;
      return matchQ && matchXP && matchJob;
    });

    filtered.sort((a, b) => {
      let aValue = a[sortField] ?? 0;
      let bValue = b[sortField] ?? 0;
      if (['xp','best_streak','quizzes','current_streak'].includes(sortField)) {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else if (sortField === 'name' || sortField === 'email' || sortField === 'job_title') {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }
      if (aValue === bValue) return 0;
      return (sortDirection === "asc")
        ? (aValue > bValue ? 1 : -1)
        : (aValue < bValue ? 1 : -1);
    });

    return filtered;
  }, [users, query, minXP, selectedJob, sortField, sortDirection]);

  // charts data
  const userEngagementData = useMemo(() => {
    if (!analytics?.user_engagement) return [];
    return analytics.user_engagement;
  }, [analytics]);

  const courseProgressData = useMemo(() => {
    if (!analytics?.course_progress) return [];
    return analytics.course_progress.map(item => ({
      name: item.course_name,
      completed: item.completed,
      in_progress: Math.max((item.in_progress || 0) - (item.completed || 0), 0),
      not_started: Math.max((item.total_users || 0) - (item.in_progress || 0), 0),
    }));
  }, [analytics]);

  const jobDistributionData = useMemo(() => {
    if (!analytics?.job_distribution) return [];
    return analytics.job_distribution.map((item, idx) => ({
      name: item.job_title || "Not specified",
      value: item.count,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [analytics]);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("desc"); }
  };

  const SortIndicator = ({ field }) => (sortField === field ? (sortDirection === "asc" ? " ↑" : " ↓") : null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <button onClick={loadAll} className="text-sm px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">Refresh</button>
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} />
              Auto-refresh (30s)
            </label>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        {/* Sticky nav */}
        <aside className="hidden lg:block col-span-3">
          <div className="sticky top-20 bg-white rounded-2xl shadow p-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">Sections</div>
            <ul className="space-y-1">
              {sections.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollTo(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${active === s.id ? "bg-indigo-600 text-white" : "hover:bg-gray-100 text-gray-700"}`}
                  >
                    <span className="mr-1">{s.emoji}</span> {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Content */}
        <main className="col-span-12 lg:col-span-9 space-y-10">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{error}</div>}

          {/* Overview */}
          <section id="overview" ref={refs.overview} className="scroll-mt-24">
            <Card title="📊 Overview">
              {!overview ? (
                <div className="text-sm text-gray-500">Loading overview…</div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <KPI label="Users" value={overview.totals?.users ?? 0} />
                    <KPI label="Courses" value={overview.totals?.courses ?? 0} />
                    <KPI label="Quiz Attempts" value={overview.totals?.quiz_attempts ?? 0} />
                  </div>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KPI label="Avg Completion Rate" value={analytics?.avg_completion_rate != null ? `${(analytics.avg_completion_rate*100).toFixed(1)}%` : 'N/A'} />
                    <KPI label="Avg Quiz Score (30d)" value={analytics?.avg_quiz_score != null ? `${analytics.avg_quiz_score.toFixed(1)}%` : 'N/A'} />
                    <KPI label="Active This Week" value={analytics?.active_this_week ?? 0} />
                  </div>
                </>
              )}
            </Card>
          </section>

          {/* Users */}
          <section id="users" ref={refs.users} className="scroll-mt-24">
            <Card title="👥 Users">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email, job…" className="w-full sm:w-80 px-3 py-2 border rounded-lg" />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Min XP</label>
                  <input type="number" min={0} value={minXP} onChange={e=>setMinXP(e.target.value)} className="w-28 px-3 py-2 border rounded-lg" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Job</label>
                  <select value={selectedJob} onChange={e=>setSelectedJob(e.target.value)} className="px-3 py-2 border rounded-lg">
                    <option value="all">All Jobs</option>
                    {jobTitles.map(job => <option key={job} value={job}>{job}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-4 flex justify-between items-center">
                <div className="text-sm text-gray-600">Showing {filteredUsers.length} of {users.length} users</div>
                <div className="text-sm">
                  <span className="font-medium">Sort by:</span>
                  <select
                    value={`${sortField}-${sortDirection}`}
                    onChange={(e)=>{ const [f,d]=e.target.value.split('-'); setSortField(f); setSortDirection(d); }}
                    className="ml-2 px-2 py-1 border rounded"
                  >
                    <option value="xp-desc">XP (High to Low)</option>
                    <option value="xp-asc">XP (Low to High)</option>
                    <option value="best_streak-desc">Best Streak (High to Low)</option>
                    <option value="best_streak-asc">Best Streak (Low to High)</option>
                    <option value="quizzes-desc">Quizzes (High to Low)</option>
                    <option value="quizzes-asc">Quizzes (Low to High)</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <Th onClick={()=>handleSort("name")}>Name <SortIndicator field="name" /></Th>
                      <Th onClick={()=>handleSort("email")}>Email <SortIndicator field="email" /></Th>
                      <Th onClick={()=>handleSort("job_title")}>Job <SortIndicator field="job_title" /></Th>
                      <Th className="text-right" onClick={()=>handleSort("xp")}>XP <SortIndicator field="xp" /></Th>
                      <Th className="text-right" onClick={()=>handleSort("current_streak")}>Current Streak <SortIndicator field="current_streak" /></Th>
                      <Th className="text-right" onClick={()=>handleSort("best_streak")}>Best Streak <SortIndicator field="best_streak" /></Th>
                      <Th className="text-right" onClick={()=>handleSort("quizzes")}>Quizzes <SortIndicator field="quizzes" /></Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <Td>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-gray-500">
                            Joined: {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                          </div>
                        </Td>
                        <Td>{u.email}</Td>
                        <Td>{u.job_title || "-"}</Td>
                        <Td className="text-right font-medium">{u.xp || 0}</Td>
                        <Td className="text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            (u.current_streak || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {u.current_streak || 0} days
                          </span>
                        </Td>
                        <Td className="text-right">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                            {u.best_streak || 0} days
                          </span>
                        </Td>
                        <Td className="text-right">{u.quizzes || 0}</Td>
                        <Td>
                          <button className="text-indigo-600 hover:text-indigo-900 text-sm" onClick={()=>console.log("View user", u.id)}>
                            View
                          </button>
                        </Td>
                      </tr>
                    ))}
                    {!filteredUsers.length && (
                      <tr><td className="p-3 text-sm text-gray-500" colSpan={8}>No users match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Analytics */}
          <section id="analytics" ref={refs.analytics} className="scroll-mt-24">
            <Card title="📈 User Analytics">
              {!analytics ? (
                <div className="text-sm text-gray-500">Loading analytics…</div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h3 className="font-semibold mb-4">User Engagement (Last 14 Days)</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={userEngagementData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="active_users" stroke="#8884d8" name="Active Users" />
                          <Line type="monotone" dataKey="quiz_attempts" stroke="#82ca9d" name="Quiz Attempts" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Course Progress</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={courseProgressData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="completed" stackId="a" fill="#8884d8" name="Completed" />
                          <Bar dataKey="in_progress" stackId="a" fill="#82ca9d" name="In Progress" />
                          <Bar dataKey="not_started" stackId="a" fill="#ffc658" name="Not Started" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">User Job Distribution</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={jobDistributionData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                               label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                            {jobDistributionData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-blue-600">Avg. Completion Rate</div>
                      <div className="text-2xl font-bold">
                        {analytics.avg_completion_rate != null ? `${(analytics.avg_completion_rate * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-green-600">Avg. Quiz Score</div>
                      <div className="text-2xl font-bold">
                        {analytics.avg_quiz_score != null ? `${analytics.avg_quiz_score.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm text-purple-600">Active This Week</div>
                      <div className="text-2xl font-bold">{analytics.active_this_week || 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* Weak Areas */}
          <section id="weak" ref={refs.weak} className="scroll-mt-24">
            <Card title="🎯 Weak Areas across the users">
              {(() => {
                const data = (recommendations?.remediate?.length
                  ? recommendations.remediate
                  : HARDCODED_WEAK.remediate);

                return (
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <Th>Course</Th>
                          <Th>Lesson</Th>
                          <Th>Difficulty Score</Th>
                          <Th>Users Struggling</Th>
                          
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((item, i) => (
                          <tr key={i} className="border-b">
                            <Td>{item.course_name}</Td>
                            <Td>{item.lesson_title}</Td>
                            <Td>
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                  className="bg-red-600 h-2.5 rounded-full"
                                  style={{ width: `${(item.difficulty_score || 0.5) * 100}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {((item.difficulty_score || 0.5) * 100).toFixed(1)}%
                              </div>
                            </Td>
                            <Td>{item.users_struggling || "Several"}</Td>
                            
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
          </section>

          {/* Upload */}
          <section id="upload" ref={refs.upload} className="scroll-mt-24">
            <Card title="📤 Upload PDF SOP → Generate Course">
              <UploadPanel />
            </Card>
          </section>

          <div className="flex justify-end">
            <button onClick={() => scrollTo("overview")} className="text-sm text-indigo-700 underline">
              Back to top ↑
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

/*  small components      */
function Card({ title, children }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
function KPI({ label, value }) {
  return (
    <div className="bg-indigo-50 p-4 rounded">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
function Th({ children, onClick, className = "" }) {
  return (
    <th className={`text-left p-2 ${onClick ? "cursor-pointer hover:bg-gray-200" : ""} ${className}`} onClick={onClick}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`p-2 align-top ${className}`}>{children}</td>;
}

/* Upload Panel */
function UploadPanel() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!file) return;
    setStatus("uploading");
    setMessage("Uploading PDF...");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
      if (res.ok) {
        setStatus("processing");
        setMessage("PDF uploaded successfully! Processing in background...");
        setTimeout(() => { setStatus("idle"); setMessage(""); setFile(null); }, 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.error || "Upload failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="max-w-md">
      <p className="text-sm text-gray-600 mb-2">Upload a PDF SOP to generate a course.</p>
      <input type="file" accept="application/pdf" onChange={(e)=>{ setFile(e.target.files?.[0] || null); setStatus("idle"); setMessage(""); }} className="mb-3" />
      <button onClick={submit} disabled={status === "uploading" || !file}
              className={`mt-3 px-4 py-2 rounded ${status === "uploading" ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
        {status === "uploading" ? "Uploading..." : "Upload"}
      </button>
      {message && (
        <div className={`mt-3 p-3 rounded text-sm ${
          status === "error" ? "bg-red-100 text-red-700 border border-red-200" :
          status === "processing" ? "bg-blue-100 text-blue-700 border border-blue-200" :
          "bg-green-100 text-green-700 border border-green-200"
        }`}>
          <div className="flex items-center">{message}</div>
          {status === "processing" && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full animate-pulse"></div>
              </div>
              <p className="mt-1 text-xs">This may take a few minutes. You can continue using the dashboard.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
