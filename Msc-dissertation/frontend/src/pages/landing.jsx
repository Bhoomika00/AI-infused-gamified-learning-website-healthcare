import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Leaderboard from "../components/leaderboard";
import Recommendations from "../components/recommendations";
import BadgesShelf from "../components/badgesShelf";

const XP_PER_QUESTION = 5;
const XP_PER_LEVEL = 1000;

export default function Landing() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/me/metrics", { credentials: "include" });
      const data = await response.json();
      
      if (data && data.metrics) {
        setMetrics(data.metrics);
      } else {
        setMetrics(null);
      }
    } catch (error) {
      console.error("Failed to load metrics:", error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    
    const handleMetricsUpdate = () => {
      loadMetrics();
    };
    
    window.addEventListener('metrics:updated', handleMetricsUpdate);
    
    return () => {
      window.removeEventListener('metrics:updated', handleMetricsUpdate);
    };
  }, [loadMetrics]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        loadMetrics();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadMetrics]);

  const totalXP = metrics?.total_xp ?? 0;
  const level = Math.max(1, Math.floor(totalXP / XP_PER_LEVEL) + 1);
  const xpIntoLevel = totalXP % XP_PER_LEVEL;
  const xpToNext = XP_PER_LEVEL - xpIntoLevel;
  const progressPercentage = Math.min(100, Math.max(0, (xpIntoLevel / XP_PER_LEVEL) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Enhanced Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24">
        {/* Background elements */}
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-200 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-64 h-64 bg-indigo-200 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-purple-200 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left: Copy */}
          <div className="text-center md:text-left">
            <div className="inline-flex items-center bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-blue-700 font-medium mb-6 shadow-sm">
              <span className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></span>
              Revolutionizing Healthcare Training
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Master Healthcare Protocols</span> Through Gamified Learning
            </h1>
            
            <p className="text-lg text-gray-700 mb-8 max-w-lg mx-auto md:mx-0 leading-relaxed">
              Transform SOPs into engaging interactive courses. Train your team in Infection Control, CPR, Patient Safety and more with AI-powered quizzes, progress tracking, and rewards.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start mb-8">
              <Link
                to="/signup"
                className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2"
              >
                <span>Get Started Free</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              
              <Link
                to="/courses"
                className="bg-white text-gray-800 border border-gray-300 px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>Browse Courses</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
              </Link>
            </div>
            
            <button 
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center md:justify-start gap-2 group mx-auto md:mx-0"
            >
              {showHowItWorks ? 'Hide how it works' : 'Learn how it works'}
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 transition-transform ${showHowItWorks ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {showHowItWorks && (
              <div className="mt-6 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3 text-lg">How MediLearn Works</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">1</div>
                    <span>Upload SOP PDFs or select from our course library</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">2</div>
                    <span>AI transforms content into interactive lessons with quizzes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">3</div>
                    <span>Track progress, earn XP, and compete on leaderboards</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">4</div>
                    <span>Receive personalized recommendations for improvement</span>
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Link 
                    to="/about" 
                    className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                  >
                    Discover more about our platform
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right: Illustration */}
          <div className="flex justify-center md:justify-end relative">
            <div className="relative w-full max-w-md">
              <img
                src="/images/hero.svg"
                alt="Healthcare training hero"
                className="w-full drop-shadow-lg transform hover:scale-105 transition-transform duration-700" 
              />
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 bg-white p-3 rounded-xl shadow-lg border border-gray-100 animate-float">
                <div className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">+125 XP</div>
                <div className="text-xs font-medium mt-1">Quiz Complete!</div>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-white p-3 rounded-xl shadow-lg border border-gray-100 animate-float" style={{animationDelay: '2s'}}>
                <div className="flex items-center gap-1 text-yellow-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xs font-bold">Level Up!</span>
                </div>
                <div className="text-xs font-medium mt-1">Reached Level 5</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Game HUD */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-blue-800 mb-10">
         Know Your Game
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left: Player card */}
          <div className="bg-white rounded-2xl shadow-lg px-8 py-8 border border-gray-100">
            {/* Streak */}
            <div className="mb-6">
              {loading ? (
                <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              ) : metrics ? (
                <p className="text-orange-600 font-semibold text-sm mb-3">
                  🔥 You're on a <strong>{metrics.current_streak}-day streak</strong>! Best:{" "}
                  <strong>{metrics.best_streak}</strong>
                </p>
              ) : (
                <p className="text-orange-600 font-semibold text-sm mb-3">
                  Sign in to start your streak!
                </p>
              )}
            </div>

            {/* XP meter */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm font-medium mb-2">
                <span className="text-blue-700">⚡ Level {level}</span>
                <span className="text-gray-600">Total XP: <strong>{totalXP}</strong></span>
              </div>
              <div className="bg-gray-200 rounded-full h-3" aria-hidden="true">
                <div
                  className="h-3 bg-gradient-to-r from-green-400 to-emerald-600 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{xpIntoLevel}/{XP_PER_LEVEL} XP</span>
                <span>{xpToNext} XP to next level</span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Each correct answer = <strong>{XP_PER_QUESTION} XP</strong>
              </div>
            </div>

            {/* Quiz Stats */}
            {metrics && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-green-600">📊</span>
                  <span className="font-medium text-green-800">Quiz Performance</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-green-700">Total Quizzes</p>
                    <p className="text-lg font-bold text-green-800">{metrics.total_quizzes || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-700">Last Score</p>
                    <p className="text-lg font-bold text-green-800">{metrics.last_score || 0}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Achievements */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Achievements</h4>
              <div className="flex gap-6 justify-center md:justify-start flex-wrap">
                <AchievementBadge 
                  img="/images/first-quiz.png" 
                  label="First Quiz" 
                  unlocked={metrics && metrics.total_quizzes > 0} 
                />
                <AchievementBadge 
                  img="/images/perfect-score.png" 
                  label="100% Score" 
                  unlocked={metrics && metrics.last_score === 100} 
                />
                <AchievementBadge 
                  img="/images/streak-7.png" 
                  label="7-Day Streak" 
                  unlocked={metrics && metrics.current_streak >= 7} 
                />
              </div>
            </div>
          </div>

          {/* Right: Live Leaderboard */}
          <div className="bg-white rounded-2xl shadow-lg px-8 py-8 border border-gray-100">
            <Leaderboard preview={true} />
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-blue-800 mb-8">Your Badges Collection</h2>
        <BadgesShelf />
        
        {/* Available Badges Section */}
        <div className="mt-12">
          <h3 className="text-2xl font-semibold text-center text-blue-800 mb-6">Available Badges</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <AvailableBadge 
              img="/images/medal.png" 
              title="Quiz Master" 
              description="Complete 10 quizzes with over 80% score" 
              progress={metrics ? Math.min(10, metrics.total_quizzes || 0) : 0} 
              total={10} 
            />
            <AvailableBadge 
              img="/images/course_completer.png" 
              title="Course Completer" 
              description="Finish 5 complete courses" 
              progress={2} 
              total={5} 
            />
            <AvailableBadge 
              img="/images/streak-7.png" 
              title="Streak Champion" 
              description="Maintain a 7-day streak" 
              progress={metrics ? Math.min(7, metrics.current_streak || 0) : 0} 
              total={7} 
            />
            <AvailableBadge 
              img="/images/quick_learner.png" 
              title="Quick Learner" 
              description="Complete a course in under 24 hours" 
              progress={0} 
              total={1} 
            />
          </div>
        </div>
      </section>
      
      {/* Recommendations Section */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-blue-800 mb-8">Your Recommendations</h2>
        <Recommendations />
      </section>

      {/* Features Section */}
      <section className="px-6 pb-20 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose MediLearn?</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Our platform is designed specifically for healthcare professionals who need engaging, effective training.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon="🚀" 
            title="Accelerated Learning" 
            description="AI-powered content transformation reduces training time by up to 60% while improving retention." 
          />
          <FeatureCard 
            icon="🏆" 
            title="Gamified Experience" 
            description="Earn badges, compete on leaderboards, and track your progress with our engaging reward system." 
          />
          <FeatureCard 
            icon="📊" 
            title="Detailed Analytics" 
            description="Track individual and team progress with comprehensive analytics and reporting tools." 
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-10 text-center text-white shadow-xl">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Training?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">Join thousands of healthcare professionals who are already using MediLearn to improve their skills and knowledge.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span>Start Learning Now</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              to="/courses"
              className="bg-transparent border border-white text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <span>Browse Courses</span>
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function AchievementBadge({ img, label, unlocked }) {
  return (
    <div className={`text-center ${unlocked ? 'opacity-100' : 'opacity-60'}`}>
      <div className={`h-16 w-16 mx-auto rounded-xl ${unlocked ? 'bg-yellow-100 shadow-md' : 'bg-gray-200'} flex items-center justify-center p-2`}>
        {unlocked ? (
          <img src={img} alt={label} className="h-10 w-10 object-contain" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </div>
      <p className="text-xs mt-2 font-medium">{label}</p>
    </div>
  );
}

function AvailableBadge({ img, title, description, progress, total }) {
  const percentage = Math.min(100, (progress / total) * 100);
  
  return (
    <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100 text-center">
      <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center p-4">
        <img src={img} alt={title} className="h-12 w-12 object-contain" />
      </div>
      <h4 className="font-semibold text-gray-800 mb-2">{title}</h4>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <div className="bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className="h-2 bg-blue-600 rounded-full transition-all" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500">
        {progress}/{total} ({Math.round(percentage)}%)
      </p>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}