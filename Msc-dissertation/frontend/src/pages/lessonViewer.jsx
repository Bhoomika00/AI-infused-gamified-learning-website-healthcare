import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import FurtherReading from "../components/FurtherReading";
import WeakAreas from "../components/weakAreas";

const CHUNK_SIZE = 5; //Always show results after every 5 lessons

export default function LessonViewer() {
  const { slug: slugParam } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = slugParam || window.location.pathname.split("/").pop();

  // course data
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  // chunk navigation
  const [chunkIndex, setChunkIndex] = useState(0);        // which 5-pack we're on
  const [selectedIndex, setSelectedIndex] = useState(0);  // index within the current 5-pack
  const [unlockedChunks, setUnlockedChunks] = useState(new Set([0])); // Track unlocked modules

  // lesson UI
  const [showFull, setShowFull] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState({}); // keys: `${globalIdx}-${qIdx}` -> {selected, correct}
  const [score, setScore] = useState(0);
  const [completedLessons, setCompletedLessons] = useState({});

  // per-question UI
  const [hintOpen, setHintOpen] = useState({}); // key -> boolean

  // result screen for each 5-pack
  const [showChunkSummary, setShowChunkSummary] = useState(false);
  const [chunkSummary, setChunkSummary] = useState(null); // {score,total,xp,metrics,recs,topic}

  //    load course once   
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/course/${slug}`, { credentials: "include" });
        const data = await res.json();
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : (data?.lessons || []);
        setAllLessons(arr);
        
        // Check if there's a specific lesson parameter in the URL
        const lessonId = searchParams.get('lesson');
        if (lessonId) {
          // Find the lesson index by ID
          const lessonIndex = arr.findIndex(lesson => 
            lesson.lesson_id === parseInt(lessonId) || lesson.id === parseInt(lessonId)
          );
          
          if (lessonIndex !== -1) {
            const chunkIdx = Math.floor(lessonIndex / CHUNK_SIZE);
            const selectedIdx = lessonIndex % CHUNK_SIZE;
            
            // Unlock all chunks up to this one
            const newUnlocked = new Set(unlockedChunks);
            for (let i = 0; i <= chunkIdx; i++) {
              newUnlocked.add(i);
            }
            setUnlockedChunks(newUnlocked);
            
            setChunkIndex(chunkIdx);
            setSelectedIndex(selectedIdx);
          }
        } else {
          setChunkIndex(0);
          setSelectedIndex(0);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load course.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, searchParams]);

  // compute current chunk lessons
  const chunkStart = chunkIndex * CHUNK_SIZE;
  const chunkEnd = Math.min(allLessons.length, chunkStart + CHUNK_SIZE);
  const chunkLessons = useMemo(
    () => allLessons.slice(chunkStart, chunkEnd),
    [allLessons, chunkStart, chunkEnd]
  );

  // current lesson (within chunk)
  const current = chunkLessons[selectedIndex] || null;

  // global lesson index (inside the whole course)
  const globalLessonIdx = chunkStart + selectedIndex;

  // auto-complete lessons with no questions
  useEffect(() => {
    if (!current) return;
    const totalQ = (current?.questions || []).length;
    if (totalQ === 0) {
      setCompletedLessons((p) => ({ ...p, [globalLessonIdx]: true }));
    }
    // reset toggles when lesson changes
    setHintOpen({});
  }, [current, globalLessonIdx]);

  //    - helpers    -
  const safeGetAnswer = (q, opt) => {
    if (Array.isArray(q.answer)) return q.answer.includes(opt);
    return q.answer === opt;
  };
  const isLessonAllCorrect = (globalIdx, lesson, map) => {
    const totalQ = (lesson?.questions || []).length;
    if (!totalQ) return true;
    for (let i = 0; i < totalQ; i++) {
      const k = `${globalIdx}-${i}`;
      if (!map[k]?.correct) return false;
    }
    return true;
  };
  const topicForLesson = (l) =>
    l?.topic || l?.module_title || l?.lesson_title || l?.title || "healthcare";
  const getHint = (q) =>
    (q.hint && String(q.hint).trim()) ||
    "Think about the emphasis in the lesson's guidance.";

  const resetSingleQuestion = (globalIdx, qIdx) => {
    const key = `${globalIdx}-${qIdx}`;
    setAnswers((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
    setHintOpen((p) => ({ ...p, [key]: false }));
    setCompletedLessons((p) => ({ ...p, [globalIdx]: false }));
  };

  //    - answer handling    -
  const handleAnswer = (qid, selected) => {
    const q = current?.questions?.[qid];
    if (!q) return;

    const correct = safeGetAnswer(q, selected);
    const key = `${globalLessonIdx}-${qid}`;

    setAnswers((prev) => {
      const already = prev[key];
      if (already?.correct) return prev; // keep first correct locked

      const next = { ...prev, [key]: { selected, correct } };
      if (correct && !already) setScore((s) => s + 1);

      // analytics (best effort)
      fetch("/api/progress/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          course_slug: slug,
          question_text: q?.question || current?.lesson_title || "General",
          topic: topicForLesson(current),
          correct,
        }),
      }).catch(() => {});

      // completion nudge
      const totalQ = (current?.questions || []).length;
      const allAnswered = [...Array(totalQ).keys()].every((i) => next[`${globalLessonIdx}-${i}`]);
      if (isLessonAllCorrect(globalLessonIdx, current, next)) {
        setCompletedLessons((p) => ({ ...p, [globalLessonIdx]: true }));
        toast.success("Perfect! All answers correct. 🎯");
      } else if (allAnswered) {
        toast.error("Not quite right — check your choices and try again.");
      }

      return next;
    });
  };

  //    - progress posting (optional, forced)    -
  async function postLessonProgress(globalIdx, localScore = 0) {
    const l = allLessons[globalIdx];
    if (!l) return;
    // Force = true so any server daily caps don't block UX
    await fetch("/api/progress/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        course_slug: slug,
        lesson_id: l?.lesson_id || l?.id || null,
        position: globalIdx,
        score: Number.isFinite(localScore) ? localScore : 0,
        force: true,
      }),
    }).catch(() => {});
  }

  //    - chunk (5-pack) results    -
  function computeChunkAggregate() {
    let total = 0;
    let correct = 0;
    for (let li = chunkStart; li < chunkEnd; li++) {
      const lesson = allLessons[li];
      const qs = lesson?.questions || [];
      total += qs.length;
      qs.forEach((_q, qi) => {
        const a = answers[`${li}-${qi}`];
        if (a?.correct) correct += 1;
      });
    }
    return { correct, total, xp: correct * 10 };
  }

  async function buildAndShowChunkSummary() {
  // 1) aggregate this 5-pack
  const agg = computeChunkAggregate(); // { correct, total, xp }

  // 2) send a "quiz" result so XP/streak/badges & /api/me get updated
  let freshMetrics = null;
  let newBadges = [];
  try {
    const percent = agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0;
    const resp = await fetch("/api/progress/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ course_slug: slug, score: percent }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok) {
      freshMetrics = data?.metrics || null;   // server also refreshes session
      newBadges = data?.new_badges || [];
    }
    window.dispatchEvent(new Event("metrics:updated"));
  } catch { /* ignore */ }

  // 3) (optional) fetch recommendations
  let recs = { remediate: [], level_up: [], ai_discovery: [], role_based: [] };
  try {
    const r = await fetch("/api/recommendations", { credentials: "include" });
    if (r.ok) {
      const d = await r.json();
      recs = {
        remediate: Array.isArray(d?.remediate) ? d.remediate : [],
        level_up: Array.isArray(d?.level_up) ? d.level_up : [],
        ai_discovery: Array.isArray(d?.ai_discovery) ? d.ai_discovery : [],
        role_based: Array.isArray(d?.role_based) ? d.role_based : [],
      };
    }
  } catch { /* ignore */ }

  // 4) topic from last lesson in the chunk
  const topic = topicForLesson(allLessons[Math.max(chunkStart, chunkEnd - 1)]);

  setChunkSummary({
    score: agg.correct,
    total: agg.total,
    xp: agg.xp,
    metrics: freshMetrics,          // reflects updated totals/streak/xp
    badges: newBadges,              
    recs,
    topic,
    rangeLabel: `Lessons ${chunkStart + 1}–${chunkEnd}`,
  });
  setShowChunkSummary(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}


  //     next lesson / chunk     
  async function goNextLesson() {
    if (!completedLessons[globalLessonIdx]) {
      toast.error("Please complete the quiz first!");
      return;
    }

    // post single-lesson progress
    const totalQ = (current?.questions || []).length;
    let correctCnt = 0;
    for (let i = 0; i < totalQ; i++) {
      const k = `${globalLessonIdx}-${i}`;
      if (answers[k]?.correct) correctCnt += 1;
    }
    await postLessonProgress(globalLessonIdx, correctCnt);

    // end of this 5-pack?
    const isLastInChunk = selectedIndex === (chunkLessons.length - 1);
    if (isLastInChunk) {
      await buildAndShowChunkSummary();
      return;
    }

    // otherwise just move to the next lesson in chunk
    setSelectedIndex((i) => i + 1);
    setShowQuiz(false);
    setShowFull(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueToNextChunk() {
    const nextStart = (chunkIndex + 1) * CHUNK_SIZE;
    if (nextStart < allLessons.length) {
      // Unlock the next chunk
      const newUnlocked = new Set(unlockedChunks);
      newUnlocked.add(chunkIndex + 1);
      setUnlockedChunks(newUnlocked);
      
      setChunkIndex((i) => i + 1);
      setSelectedIndex(0);
      setShowChunkSummary(false);
      setChunkSummary(null);
      setShowQuiz(false);
      setShowFull(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toast.success("All lessons completed! 🥳");
      navigate("/courses");
    }
  }

  // Check if a chunk is unlocked
  const isChunkUnlocked = (chunkIdx) => {
    return unlockedChunks.has(chunkIdx);
  };

  // Check if we can navigate to previous chunk
  const canGoToPreviousChunk = () => {
    if (selectedIndex > 0) return true;
    if (chunkIndex > 0) return isChunkUnlocked(chunkIndex - 1);
    return false;
  };

  // Navigate to previous lesson or chunk
  const goToPrevious = () => {
    if (selectedIndex > 0) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (chunkIndex > 0 && isChunkUnlocked(chunkIndex - 1)) {
      // move to previous chunk's last lesson
      const prevChunkStart = (chunkIndex - 1) * CHUNK_SIZE;
      const prevChunkEnd = Math.min(allLessons.length, prevChunkStart + CHUNK_SIZE);
      setChunkIndex((c) => c - 1);
      setSelectedIndex(Math.max(0, prevChunkEnd - prevChunkStart - 1));
    }
    setShowFull(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  //UI     
  if (loading) return <div className="p-6">Loading…</div>;
  if (!current) return <div className="p-6">No lessons to show.</div>;

  const overallProgress = Math.round(((chunkStart + selectedIndex + 1) / Math.max(1, allLessons.length)) * 100);

  if (showChunkSummary && chunkSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-200 to-yellow-100 p-6">
        <Toaster position="top-center" />
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <ChunkResultsCard
            summary={chunkSummary}
            onContinue={continueToNextChunk}
            onLater={() => navigate("/")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 to-yellow-100 p-6 font-sans">
      <Toaster position="top-center" />
      <div className="max-w-5xl mx-auto space-y-6">
        {/* header */}
        <div className="bg-white shadow-lg rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">
              Module: <strong>{chunkIndex + 1}</strong> &nbsp;
              {chunkIndex > 0 && !isChunkUnlocked(chunkIndex) && (
                <span className="text-red-500 text-xs">(Locked)</span>
              )}
            </p>
            <p className="text-xs text-yellow-600">XP this session: {score * 10}</p>
          </div>

          <div className="w-full md:w-1/2">
            <div className="h-3 bg-gray-200 rounded-full">
              <div
                className="h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
              />
            </div>
            <p className="text-xs text-center text-gray-500 mt-1">
              Lesson {chunkStart + selectedIndex + 1} of {allLessons.length || 1}
            </p>
          </div>
        </div>

        {/* lesson card */}
        <div className="bg-white shadow-xl rounded-xl p-6">
          {!showQuiz ? (
            <>
              <h2 className="text-2xl font-extrabold text-purple-800 mb-3">
                🎮 {current.lesson_title || current.title || "Lesson"}
              </h2>
              {current.lesson_summary && (
                <p className="text-gray-800 leading-relaxed mb-4 text-lg">
                  {current.lesson_summary}
                </p>
              )}

              {current.full_content && (
                <div className="mb-4">
                  <button
                    className="text-purple-600 underline text-sm mb-2"
                    onClick={() => setShowFull((v) => !v)}
                  >
                    {showFull ? "Hide Full Lesson" : "Read More"}
                  </button>
                  {showFull && (
                    <div className="text-gray-700 whitespace-pre-line bg-purple-50 p-4 rounded-md border border-purple-200">
                      {current.full_content}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowQuiz(true)}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 transition"
              >
                Start Quiz
              </button>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-bold text-green-700 mb-4">🧩 Challenge Mode</h3>
              <div className="space-y-6">
                {(current?.questions || []).map((q, i) => {
                  const key = `${globalLessonIdx}-${i}`;
                  const answered = answers[key];
                  const isLocked = answered?.correct === true;
                  const showHint = !!hintOpen[key];

                  return (
                    <div key={i} className="border-2 border-purple-200 bg-purple-50 p-5 rounded-lg">
                      <p className="font-semibold mb-2 text-lg">{i + 1}. {q.question}</p>

                      {Array.isArray(q.options) && q.options.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt, j) => {
                            const isSelected = answered?.selected === opt;
                            const isCorrect = answered?.correct && isSelected;
                            return (
                              <button
                                key={j}
                                disabled={isLocked && !isSelected}
                                onClick={() => handleAnswer(i, opt)}
                                className={`text-left px-4 py-2 rounded-lg border transition font-medium ${
                                  isCorrect
                                    ? "bg-green-100 border-green-400 text-green-800"
                                    : isSelected && answered && !answered.correct
                                    ? "bg-red-100 border-red-400 text-red-700"
                                    : "bg-white border-gray-300 hover:bg-purple-100"
                                }`}
                              >
                                {opt}
                                {isCorrect && <CheckCircle className="inline ml-2 w-4 h-4" />}
                                {isSelected && answered && !answered.correct && (
                                  <XCircle className="inline ml-2 w-4 h-4" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm italic text-gray-600">(No options available)</p>
                      )}

                      {/* Feedback (no reveal answer) */}
                      {answered && (
                        <div
                          className={`mt-4 rounded-lg p-4 border ${
                            answered.correct
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          {answered.correct ? (
                            <>
                              <p className="font-semibold text-green-800 mb-1">Correct! 🎉</p>
                              <p className="text-green-700 text-sm">
                                {q.explanation && String(q.explanation).trim()
                                  ? q.explanation
                                  : "Nice work — that matches the guidance taught in this lesson."}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-red-800 mb-2">Not quite — try again.</p>

                              <button
                                className="text-xs underline text-red-700"
                                onClick={() => setHintOpen((p) => ({ ...p, [key]: !p[key] }))}
                              >
                                {showHint ? "Hide hint" : "Show hint"}
                              </button>

                              {showHint && (
                                <div className="mt-2 text-sm text-red-800">💡 {getHint(q)}</div>
                              )}

                              <div className="mt-3">
                                <button
                                  onClick={() => resetSingleQuestion(globalLessonIdx, i)}
                                  className="px-3 py-1 rounded border text-sm hover:bg-white/60"
                                >
                                  Try again
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => {
                    const totalQ = (current?.questions || []).length;
                    const copy = { ...answers };
                    for (let i = 0; i < totalQ; i++) delete copy[`${globalLessonIdx}-${i}`];
                    setAnswers(copy);
                    setCompletedLessons((p) => ({ ...p, [globalLessonIdx]: false }));
                    toast("Answers cleared for this lesson. Try again!");
                  }}
                  className="text-sm underline text-gray-600"
                >
                  Reset this lesson
                </button>

                <button
                  onClick={goNextLesson}
                  disabled={!completedLessons[globalLessonIdx]}
                  className={`px-5 py-2 rounded-full font-semibold transition ${
                    completedLessons[globalLessonIdx]
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {selectedIndex === chunkLessons.length - 1 ? "Finish Pack →" : "Next →"}
                </button>
              </div>
            </>
          )}

          {/* bottom navigation (only when not quizzing) */}
          {!showQuiz && (
            <div className="flex justify-between mt-8">
              <button
                onClick={goToPrevious}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 text-sm"
                disabled={!canGoToPreviousChunk()}
              >
                ← Previous
              </button>

              <button
                onClick={() => setShowQuiz(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700"
              >
                Start Quiz
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/*    Chunk (5-pack) Results Card    */

function ChunkResultsCard({ summary, onContinue, onLater }) {
  const m = summary?.metrics || {};
  const recs = summary?.recs || { remediate: [], level_up: [], ai_discovery: [], role_based: [] };
  const topic = summary?.topic || "healthcare";

  const Group = ({ title, items }) => {
    if (!Array.isArray(items) || !items.length) return null;
    return (
      <div className="mb-5">
        <h5 className="font-semibold text-purple-800 mb-2">{title}</h5>
        <ul className="list-disc ml-6 space-y-1">
          {items.slice(0, 6).map((it, i) => (
            <li key={i} className="text-sm">
              {it.lesson_title ? (
                <>
                  <span className="font-medium">{it.course_name}</span> — {it.lesson_title}
                </>
              ) : (
                <span className="font-medium">{it.course_name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div>
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">
          Module Complete ({summary?.rangeLabel})
        </h2>
        <p className="text-gray-600">
          Score <strong>{summary?.score ?? 0}/{summary?.total ?? 0}</strong> —{" "}
          <strong>{summary?.xp ?? 0} XP</strong>
          {typeof m?.current_streak === "number" && (
            <> | Streak: <strong>{m.current_streak} day{m.current_streak === 1 ? "" : "s"}</strong></>
          )}
        </p>
      </div>

      <div className="bg-green-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-green-800 mb-2">Highlights</h3>
        <p className="text-sm text-green-700">
          Nice work! Review any weak areas below and skim a couple of trusted sources to lock it in.
        </p>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Your Weak Areas</h3>
        <WeakAreas />
      </div>

      <Group title="🧩 Strengthen weak areas" items={recs.remediate} />
      <Group title="⬆️ Continue where you left off" items={recs.level_up} />
      <Group title="✨ Because you might like" items={recs.ai_discovery} />
      <Group title="💼 Role-relevant picks" items={recs.role_based} />

      <div className="mt-6 border-t pt-4">
        <h4 className="text-lg font-bold mb-2">Further Reading</h4>
        <p className="text-sm text-gray-600 mb-3">Read 2–3 of these sources to reach mastery.</p>
        <FurtherReading topic={topic} limit={5} />
      </div>

      <div className="mt-6 flex gap-2 justify-end">
        <button className="px-4 py-2 rounded border" onClick={onLater}>
          Not now
        </button>
        <button
          className="px-5 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-semibold"
          onClick={onContinue}
        >
          Continue to next lessons
        </button>
      </div>
    </div>
  );
}