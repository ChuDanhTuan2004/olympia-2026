import React, { useState } from 'react';
import { GameState } from '../types';
import { ShieldAlert, Play, Pause, FastForward, Plus, Minus, History, RotateCcw } from 'lucide-react';

interface AdminControlDrawerProps {
  room: GameState;
  onNextRound: (targetRound?: string) => void;
  onStartTimer: (seconds?: number) => void;
  onPauseTimer: () => void;
  onUpdateScore: (playerId: string, newScore: number) => void;
  onResetGame: () => void;
}

export const AdminControlDrawer: React.FC<AdminControlDrawerProps> = ({
  room,
  onNextRound,
  onStartTimer,
  onPauseTimer,
  onUpdateScore,
  onResetGame,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(room.players[0]?.id || '');
  const [scoreAdjustInput, setScoreAdjustInput] = useState('10');

  const selectedPlayer = room.players.find((p) => p.id === selectedPlayerId) || room.players[0];

  const handleScoreAdjust = (delta: number) => {
    if (!selectedPlayer) return;
    const newScore = Math.max(0, selectedPlayer.score + delta);
    onUpdateScore(selectedPlayer.id, newScore);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="py-3 px-5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-full shadow-2xl shadow-teal-600/30 flex items-center gap-2 border border-teal-500 transition-all transform hover:scale-105"
        >
          <ShieldAlert className="w-5 h-5 stroke-[1.75]" /> BẢNG CHỦ PHÒNG
        </button>
      ) : (
        <div className="w-80 sm:w-96 bg-white/90 border border-stone-200/80 rounded-3xl p-5 shadow-2xl shadow-stone-300/80 backdrop-blur-xl text-slate-800 space-y-4 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
            <div className="flex items-center gap-2 font-bold text-teal-800 text-sm">
              <ShieldAlert className="w-4 h-4 text-teal-600 stroke-[1.75]" /> ĐIỀU KHIỂN CHỦ PHÒNG
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 font-bold text-xs p-1"
            >
              ✕ Đóng
            </button>
          </div>

          {/* Round Jumping Controls */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">CHUYỂN VÒNG THI</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'warmup', label: '1. Khởi động' },
                { id: 'obstacle', label: '2. VCNV' },
                { id: 'acceleration', label: '3. Tăng tốc' },
                { id: 'finish', label: '4. Về đích' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => onNextRound(r.id)}
                  className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all ${
                    room.currentRound === r.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-stone-100 hover:bg-stone-200/80 text-slate-700 border border-stone-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timer Controls */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">ĐỒNG HỒ TÍNH GIỜ ({room.timerSeconds}s)</label>
            <div className="flex gap-2">
              {room.timerActive ? (
                <button
                  onClick={onPauseTimer}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1 shadow-sm"
                >
                  <Pause className="w-4 h-4 stroke-[1.75]" /> Tạm dừng
                </button>
              ) : (
                <button
                  onClick={() => onStartTimer()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1 shadow-sm"
                >
                  <Play className="w-4 h-4 stroke-[1.75]" /> Tiếp tục
                </button>
              )}
              <button
                onClick={() => onStartTimer(60)}
                className="py-2 px-3 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 font-mono font-bold text-xs rounded-2xl text-teal-800 shadow-sm"
              >
                60s
              </button>
              <button
                onClick={() => onStartTimer(30)}
                className="py-2 px-3 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 font-mono font-bold text-xs rounded-2xl text-teal-800 shadow-sm"
              >
                30s
              </button>
            </div>
          </div>

          {/* Manual Score Adjust */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">SỬA ĐIỂM THÍ SINH TRỰC TIẾP</label>
            <div className="space-y-2">
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-teal-500"
              >
                {room.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.score} điểm)
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => handleScoreAdjust(10)}
                  className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[1.75]" /> +10Đ
                </button>
                <button
                  onClick={() => handleScoreAdjust(-10)}
                  className="flex-1 py-2 bg-red-50 hover:bg-red-100/80 border border-red-200 text-red-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-1 shadow-sm"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[1.75]" /> -10Đ
                </button>
              </div>
            </div>
          </div>

          {/* Live Activity Log Stream */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <History className="w-3 h-3 stroke-[1.75]" /> NHẬT KÝ TRẬN ĐẤU
              </span>
            </div>
            <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-3 max-h-32 overflow-y-auto space-y-1 text-[11px] font-mono">
              {room.logs.slice(0, 15).map((log) => (
                <div key={log.id} className="text-slate-700 leading-tight">
                  <span className="text-slate-400">[{log.time}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onResetGame}
            className="w-full py-2.5 bg-stone-100 hover:bg-stone-200/80 border border-red-200 text-red-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" /> ĐẶT LẠI TRẬN THI ĐẤU
          </button>

        </div>
      )}
    </div>
  );
};
