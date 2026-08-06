import React from 'react';
import { Award, Volume2, VolumeX, Wifi, ShieldAlert, Sparkles, Copy, Check, BookOpen, Trash2 } from 'lucide-react';
import { GameState } from '../types';
import { sounds } from '../lib/audio';

interface HeaderProps {
  room: GameState;
  isHost: boolean;
  playerId?: string;
  isConnected: boolean;
  onOpenRules?: () => void;
  onCancelRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ room, isHost, playerId, isConnected, onOpenRules, onCancelRoom }) => {
  const [isMuted, setIsMuted] = React.useState(sounds.getMuted());
  const [copied, setCopied] = React.useState(false);

  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roundTitles: Record<string, string> = {
    warmup: '1. KHỞI ĐỘNG',
    obstacle: '2. VƯỢT CHƯỚNG NGẠI VẬT',
    acceleration: '3. TĂNG TỐC',
    finish: '4. VỀ ĐÍCH',
    summary: 'TỔNG KẾT & TRAO THƯỞNG',
  };

  return (
    <header className="bg-neutral-950/90 border-b border-neutral-800 backdrop-blur-xl sticky top-0 z-40 px-4 py-3 text-white shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 text-white font-bold shadow-sm">
            <Award className="w-5 h-5 text-white stroke-[1.75]" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg md:text-xl tracking-tight text-white">
              ĐƯỜNG LÊN ĐỈNH OLYMPIA
            </h1>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-semibold uppercase tracking-wider text-white">{roundTitles[room.currentRound] || 'Đang chờ'}</span>
              <span>•</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${isConnected ? 'bg-neutral-800 text-neutral-200 border border-neutral-700' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                <Wifi className="w-3 h-3 stroke-[1.75]" /> {isConnected ? 'Trực tuyến' : 'Mất kết nối'}
              </span>
            </div>
          </div>
        </div>

        {/* Room Code & Role Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl px-3.5 py-1.5 shadow-sm">
            <span className="text-xs text-neutral-400">Mã phòng:</span>
            <span className="font-mono font-bold text-white text-sm tracking-wider">{room.roomCode}</span>
            <button
              onClick={handleCopyCode}
              title="Sao chép mã phòng"
              className="text-neutral-400 hover:text-white transition-colors p-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white stroke-[1.75]" /> : <Copy className="w-3.5 h-3.5 stroke-[1.75]" />}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-neutral-800 border border-neutral-700 text-white">
            {isHost ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-white stroke-[1.75]" /> CHỦ PHÒNG · THÍ SINH
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white stroke-[1.75]" /> THÍ SINH
              </>
            )}
          </div>

          {isHost && onCancelRoom && (
            <button
              onClick={() => {
                if (window.confirm('Hủy phòng sẽ đưa tất cả người chơi về sảnh. Bạn có chắc chắn?')) {
                  onCancelRoom();
                }
              }}
              className="flex items-center gap-1.5 rounded-2xl border border-red-800 bg-red-950 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-900 hover:text-white"
              title="Hủy phòng"
            >
              <Trash2 className="h-4 w-4 stroke-[1.75]" />
              <span className="hidden md:inline">HỦY PHÒNG</span>
            </button>
          )}

          <button
            onClick={handleToggleMute}
            className="p-2 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors shadow-sm"
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400 stroke-[1.75]" /> : <Volume2 className="w-4 h-4 text-white stroke-[1.75]" />}
          </button>

          {onOpenRules && (
            <button
              onClick={onOpenRules}
              className="p-2 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors shadow-sm"
              title="Xem Luật Chơi"
            >
              <BookOpen className="w-4 h-4 stroke-[1.75]" />
            </button>
          )}
        </div>
      </div>

      {/* Players Scoreboard Bar */}
      <div className="max-w-7xl mx-auto mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {room.players.map((player, idx) => {
          const isSelf = player.id === playerId;
          const isBuzzed = room.activeBuzzer?.playerId === player.id;

          return (
            <div
              key={player.id}
              className={`relative overflow-hidden rounded-2xl p-3 border transition-all duration-300 ${
                isBuzzed
                  ? 'bg-neutral-800 border-white shadow-lg ring-2 ring-white/50'
                  : 'bg-neutral-900/90 border-neutral-800 shadow-sm'
              } ${isSelf ? 'ring-1 ring-white/40' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-sm bg-neutral-800 border border-neutral-700"
                  >
                    {player.avatar}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white truncate">{player.name}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">SĐ-0{idx + 1}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${player.isOnline ? 'bg-white animate-pulse' : 'bg-neutral-600'}`}
                      />
                      {player.isOnline ? 'Sẵn sàng' : 'Ngoại tuyến'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-2xl font-black font-mono tracking-tight text-white">
                    {player.score}
                  </span>
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Điểm</span>
                </div>
              </div>

              {isBuzzed && (
                <div className="absolute top-0 right-0 bg-white text-black font-extrabold text-[10px] px-2 py-0.5 rounded-bl-xl shadow-sm animate-bounce">
                  🔔 ĐÃ BẤM CHUÔNG
                </div>
              )}
            </div>
          );
        })}

        {/* Empty Slot Placeholder if < 4 players */}
        {room.players.length < 4 && (
          <div className="rounded-2xl p-3 border border-dashed border-neutral-800 bg-neutral-950/40 flex items-center justify-center text-neutral-500 text-xs gap-2">
            <span className="animate-pulse">⏳</span> Đang chờ Thí sinh {room.players.length + 1}...
          </div>
        )}
      </div>
    </header>
  );
};
