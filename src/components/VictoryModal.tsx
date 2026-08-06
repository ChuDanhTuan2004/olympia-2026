import React, { useEffect } from 'react';
import { GameState } from '../types';
import { Trophy, Award, RefreshCw, Sparkles, Star } from 'lucide-react';
import { sounds } from '../lib/audio';

interface VictoryModalProps {
  room: GameState;
  isHost: boolean;
  onResetGame: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ room, isHost, onResetGame }) => {
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const runnerUp = sortedPlayers[1];

  useEffect(() => {
    sounds.playVictory();
  }, []);

  if (!winner) return null;

  return (
    <div className="olympia-victory fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
      <div className="olympia-victory-card max-w-2xl w-full border rounded-3xl p-6 sm:p-10 text-center shadow-2xl relative overflow-hidden">
        {/* Soft Teal Glowing Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Laurel Wreath Badge */}
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-teal-600 text-white font-black flex items-center justify-center text-5xl shadow-xl shadow-teal-600/25 border-4 border-white mx-auto animate-bounce">
            {winner.avatar}
          </div>
          <div className="absolute -top-2 -right-2 bg-teal-800 text-white p-2 rounded-full shadow-md">
            <Trophy className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-extrabold text-xs uppercase tracking-widest mb-3">
          <Sparkles className="w-4 h-4 text-teal-600 stroke-[1.75]" /> NHÀ VÔ ĐỊCH OLYMPIA <Sparkles className="w-4 h-4 text-teal-600 stroke-[1.75]" />
        </div>

        <h2 className="olympia-brand-title text-3xl sm:text-4xl font-black mb-2">
          {winner.name.toUpperCase()}
        </h2>

        <div className="text-4xl sm:text-5xl font-black font-mono text-teal-800 tracking-tight mb-6">
          {winner.score} <span className="text-lg font-bold text-teal-600">ĐIỂM</span>
        </div>

        <p className="text-slate-600 text-sm max-w-md mx-auto mb-8 leading-relaxed">
          Chúc mừng {winner.name} đã xuất sắc vượt qua các vòng thi và vinh dự nhận Vòng Nguyệt Quế Đường Lên Đỉnh Olympia!
        </p>

        {/* Scores Comparison Table */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 mb-8 space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">BẢNG ĐIỂM CHUNG CUỘC</h3>
          <div className="space-y-2">
            {sortedPlayers.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  idx === 0
                    ? 'bg-teal-50 border-teal-200 text-teal-900 shadow-sm font-bold'
                    : 'bg-white border-stone-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm w-6 text-center">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '4️⃣'}
                  </span>
                  <span className="text-2xl">{p.avatar}</span>
                  <span className="font-bold text-sm">{p.name}</span>
                </div>
                <span className="font-mono font-black text-lg text-teal-800">{p.score} đ</span>
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <button
            onClick={onResetGame}
            className="w-full py-4 px-6 bg-teal-600 hover:bg-teal-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-teal-600/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <RefreshCw className="w-5 h-5 stroke-[1.75]" /> BẮT ĐẦU TRẬN THI ĐẤU MỚI
          </button>
        )}
      </div>
    </div>
  );
};
