import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ask backend to filter by logged-in user's role
    fetch('/api/courses?mine=1', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to load courses:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-sky-100 to-blue-100 z-0" />
      <div
        className="absolute inset-0 opacity-10 z-0 bg-center bg-cover"
        style={{ backgroundImage: `url('/images/medical-equipment.jpg')` }}
      />
      <div className="relative z-10 p-8 max-w-7xl mx-auto">
        <h2 className="text-4xl font-extrabold text-center mb-10 text-indigo-800 drop-shadow-md">
          🏥 Your Courses
        </h2>

        {loading ? (
          <div className="text-center text-gray-600">Loading courses…</div>
        ) : courses.length === 0 ? (
          <div className="text-center bg-white/90 rounded-xl p-8 border">
            <p className="text-gray-700 mb-4">
              No courses matched your role yet.
            </p>
            <Link
              to="/login"
              className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
            >
              Sign in / Change role
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => {
              const formattedTitle = course.title
              .replace(/[-_]/g, ' ')  // Replace hyphens and underscores with spaces
              .toUpperCase()          // Convert everything to uppercase
              .trim();                // Remove leading/trailing spaces

              return (
                <div
                  key={course.id}
                  className="bg-white border-2 border-indigo-200 rounded-2xl shadow-xl hover:shadow-indigo-300 transition-all p-6 relative group hover:scale-105"
                >
                  <div className="absolute top-3 right-3 bg-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md animate-pulse flex items-center gap-1">
                    <Star className="w-4 h-4" /> XP +100
                  </div>
                  <br/>

                  <div className="text-xs uppercase tracking-wide text-indigo-500 mb-1">
                    {course.target_role === 'general' ? 'All Roles' : course.target_role}
                  </div>

                  <h3 className="text-2xl font-semibold text-indigo-700 mb-4 transition-all group-hover:text-indigo-900">
                    {formattedTitle}
                  </h3>

                  <Link
                    to={`/modules/${course.slug}`}
                    className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition duration-300 font-medium"
                  >
                    🚀 View Modules
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Optional: small link to see everything regardless of role */}
        <div className="text-center mt-8">
          <Link
            to="#"
            onClick={(e) => {
              e.preventDefault();
              // reload without filtering
              setLoading(true);
              fetch('/api/courses', { credentials: 'include' })
                .then(res => res.json())
                .then(data => setCourses(Array.isArray(data) ? data : []))
                .catch(() => {})
                .finally(() => setLoading(false));
            }}
            className="text-sm text-indigo-700 underline hover:text-indigo-900"
          >
            Show all courses
          </Link>
        </div>
      </div>
    </div>
  );
}
