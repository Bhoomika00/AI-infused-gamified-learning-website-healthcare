import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Lock, CheckCircle, Play } from "lucide-react";

const LESSONS_PER_MODULE = 5;

export default function Modules() {
  const { slug } = useParams();
  const [lessons, setLessons] = useState([]);
  const [plan, setPlan] = useState(null); // we use current_position from here
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // 1) get lessons
        const r = await fetch(`/api/course/${slug}`, { credentials: "include" });
        const data = await r.json();
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : (data?.lessons || []);
        setLessons(arr);

        // 2) get progress summary (current_position == number of lessons completed)
        const s = await fetch(`/api/course/${slug}/plan/summary`, { credentials: "include" });
        const summary = s.ok ? await s.json() : null;
        if (!mounted) return;
        setPlan(summary || { current_position: 0 });
      } catch (e) {
        setPlan({ current_position: 0 });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  const modules = useMemo(() => {
    const total = lessons.length;
    const count = Math.ceil(total / LESSONS_PER_MODULE);
    return Array.from({ length: count }, (_, i) => {
      const start = i * LESSONS_PER_MODULE;
      const end = Math.min(start + LESSONS_PER_MODULE, total) - 1;
      return { index: i, start, end, count: end - start + 1 };
    });
  }, [lessons]);

  const currentPos = plan?.current_position ?? 0; // number of lessons completed so far
  const currentModuleIndex = Math.floor(currentPos / LESSONS_PER_MODULE);

  if (loading) {
    return <div className="p-6">Loading modules…</div>;
  }

  if (!lessons.length) {
    return <div className="p-6">No lessons found in this course.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-sky-100 to-blue-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-indigo-800">
            Modules for: <span className="text-indigo-600">{slug}</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Each module has {LESSONS_PER_MODULE} lessons. Finish a module to unlock the next.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {modules.map((m) => {
            const completedInModule = Math.min(
              Math.max(currentPos - m.start, 0),
              m.count
            );
            const isCompleted = completedInModule >= m.count;
            const isLocked = m.index > currentModuleIndex;
            const isCurrent = m.index === currentModuleIndex && !isCompleted;

            const pct =
              m.count > 0 ? Math.round((completedInModule / m.count) * 100) : 0;

            return (
              <div
                key={m.index}
                className={`rounded-xl border shadow bg-white p-5 relative ${
                  isLocked ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-indigo-800">
                    Module {m.index + 1}
                  </h3>
                  {isCompleted ? (
                    <span className="inline-flex items-center text-emerald-700 text-sm font-medium">
                      <CheckCircle className="w-4 h-4 mr-1" /> Completed
                    </span>
                  ) : isCurrent ? (
                    <span className="text-sm text-blue-700 font-medium">
                      In progress
                    </span>
                  ) : isLocked ? (
                    <span className="inline-flex items-center text-gray-500 text-sm">
                      <Lock className="w-4 h-4 mr-1" /> Locked
                    </span>
                  ) : null}
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  Lessons {m.start + 1}–{m.end + 1} • {m.count} total
                </p>

                {/* Progress bar */}
                <div className="h-2 bg-gray-200 rounded-full mb-3">
                  <div
                    className="h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mb-4">
                  {completedInModule}/{m.count} lessons completed
                </div>

                {/* Start/Continue button */}
                <div className="flex justify-end">
                  {isLocked ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-300 text-gray-600 cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                      Locked
                    </button>
                  ) : (
                    <Link
                      to={`/viewer/${slug}?start=${isCompleted ? m.start : Math.max(m.start, currentPos)}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      <Play className="w-4 h-4" />
                      {isCompleted ? "Review Module" : isCurrent ? "Continue" : "Start Module"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <Link
            to="/courses"
            className="text-sm text-indigo-700 underline hover:text-indigo-900"
          >
            ← Back to courses
          </Link>
        </div>
      </div>
    </div>
  );
}
