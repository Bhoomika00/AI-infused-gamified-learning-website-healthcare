import React from 'react';
import Leaderboard from '../components/leaderboard';

export default function LeaderboardPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">📊 Full Leaderboard</h1>
      <Leaderboard />
    </div>
  );
}
