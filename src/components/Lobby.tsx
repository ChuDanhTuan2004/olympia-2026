import React, { useState } from 'react';
import { ArrowLeft, Award, Shield, UserCheck, Sparkles, Play, Layers, LogOut, UserCog } from 'lucide-react';
import { AccountRole, GameState, Role } from '../types';

interface LobbyProps {
  room?: GameState;
  role?: Role;
  onJoinRoom: (roomCode: string, role: Role, name?: string, avatar?: string) => void;
  onStartGame: (topic: string) => void;
  isGenerating: boolean;
  accountRole: AccountRole;
  accountUsername: string;
  onOpenAccountManager: () => void;
  onLogout: () => void;
}

const AVATARS = ['🦁', '🦅', '🐉', '⚡', '🚀', '🎓', '🏆', '🔥'];

export const Lobby: React.FC<LobbyProps> = ({
  room,
  role = 'spectator',
  onJoinRoom,
  onStartGame,
  isGenerating,
  accountRole,
  accountUsername,
  onOpenAccountManager,
  onLogout,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState(accountUsername);
  const [selectedAvatar, setSelectedAvatar] = useState('🦁');
  const [customTopic, setCustomTopic] = useState('');
  const [mode, setMode] = useState<'welcome' | 'join_player' | 'create_mc'>('welcome');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim() || !playerNameInput.trim()) return;
    onJoinRoom(roomCodeInput.trim().toUpperCase(), 'player', playerNameInput.trim(), selectedAvatar);
  };

  const handleCreateMC = () => {
    const code = roomCodeInput.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    onJoinRoom(code, 'admin');
  };

  if (!room) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
        <div className="max-w-xl w-full bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-stone-200/60 backdrop-blur-md">
          <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4 text-slate-700">
            <div className="flex items-center gap-2 text-xs font-bold">
              <UserCog className="h-4 w-4" /> {accountUsername}
              <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] uppercase">{accountRole === 'admin' ? 'Admin' : 'Người chơi'}</span>
            </div>
            <div className="flex items-center gap-2">
              {accountRole === 'admin' && (
                <button onClick={onOpenAccountManager} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold hover:bg-stone-100">
                  Quản lý tài khoản
                </button>
              )}
              <button onClick={onLogout} className="rounded-xl border border-stone-200 p-2 hover:bg-stone-100" aria-label="Đăng xuất">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Header Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 font-bold text-2xl shadow-sm mb-4">
              <Award className="w-9 h-9 stroke-[1.75]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              ĐƯỜNG LÊN ĐỈNH OLYMPIA
            </h2>
          </div>

          {mode === 'welcome' && (
            <div className="space-y-4">
              {accountRole === 'player' && (
                <button
                  onClick={() => setMode('join_player')}
                  className="w-full py-4 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-teal-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <UserCheck className="w-5 h-5 stroke-[1.75]" /> THAM GIA THI ĐẤU
                </button>
              )}

              {accountRole === 'admin' && (
                <button
                  onClick={() => setMode('create_mc')}
                  className="w-full py-4 px-6 rounded-2xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200/80 text-slate-700 font-bold text-base flex items-center justify-center gap-3 shadow-sm transition-all"
                >
                  <Shield className="w-5 h-5 text-teal-600 stroke-[1.75]" /> TẠO PHÒNG MỚI
                </button>
              )}
            </div>
          )}

          {mode === 'join_player' && (
            <form onSubmit={handleJoinSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Mã phòng thi</label>
                <input
                  type="text"
                  placeholder="Nhập mã 4 chữ số (VD: 8821)"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-teal-800 font-mono font-bold text-center text-xl tracking-widest placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-teal-500 shadow-inner"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Họ tên Thí sinh</label>
                <input
                  type="text"
                  placeholder="Nhập tên của bạn"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-slate-800 font-semibold focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Biểu tượng linh vật</label>
                <div className="flex flex-wrap gap-2 justify-center">
                  {AVATARS.map((av) => (
                    <button
                      type="button"
                      key={av}
                      onClick={() => setSelectedAvatar(av)}
                      className={`w-11 h-11 rounded-2xl text-2xl flex items-center justify-center transition-all ${selectedAvatar === av
                        ? 'bg-teal-500/20 border-2 border-teal-500 scale-105 shadow-sm'
                        : 'bg-stone-100 border border-stone-200 hover:bg-stone-200/60'
                        }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="w-1/3 py-3 px-4 bg-stone-100 hover:bg-stone-200/80 text-slate-600 font-semibold rounded-2xl text-sm border border-stone-200/80 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
                  Quay lại
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm shadow-md shadow-teal-600/20"
                >
                  VÀO PHÒNG THI
                </button>
              </div>
            </form>
          )}

          {mode === 'create_mc' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Tạo mã phòng tùy chỉnh</label>
                <input
                  type="text"
                  placeholder="Tự động tạo mã ngẫu nhiên nếu để trống"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-teal-800 font-mono font-bold text-center text-xl tracking-widest placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-teal-500 shadow-inner"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="w-1/2 py-3 px-4 bg-stone-100 hover:bg-stone-200/80 text-slate-600 font-semibold rounded-2xl text-sm border border-stone-200/80 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
                  QUAY LẠI
                </button>
                <button
                  type="button"
                  onClick={handleCreateMC}
                  className="w-1/2 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm shadow-md shadow-teal-600/20 flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4 stroke-[1.75]" /> BẮT ĐẦU
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Room waiting state screen
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-stone-200/60 backdrop-blur-md">
        <div className="mb-5 flex items-center justify-end gap-2 text-slate-700">
          <span className="mr-auto text-xs font-bold">Đăng nhập: {accountUsername}</span>
          {accountRole === 'admin' && (
            <button onClick={onOpenAccountManager} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold hover:bg-stone-100">
              Quản lý tài khoản
            </button>
          )}
          <button onClick={onLogout} className="rounded-xl border border-stone-200 p-2 hover:bg-stone-100" aria-label="Đăng xuất">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-stone-200/80 pb-6 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">PHÒNG CHỜ THI ĐẤU</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">SẴN SÀNG TRẬN THI ĐẤU</h2>
          </div>
          <div className="bg-stone-100/80 border border-stone-200/80 rounded-2xl px-5 py-2.5 text-center shadow-sm">
            <span className="text-xs text-slate-500 block uppercase font-medium">Mã Phòng Thi</span>
            <span className="font-mono font-black text-2xl text-teal-800 tracking-widest">{room.roomCode}</span>
          </div>
        </div>

        {/* Players Slot List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[0, 1, 2, 3].map((idx) => {
            const player = room.players[idx];
            return (
              <div
                key={idx}
                className={`rounded-2xl p-5 border flex items-center gap-4 transition-all ${player
                  ? 'bg-stone-50/80 border-teal-500/30 shadow-sm'
                  : 'bg-stone-50/40 border-dashed border-stone-300'
                  }`}
              >
                {player ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-white border border-teal-200 flex items-center justify-center text-3xl shrink-0 shadow-sm">
                      {player.avatar}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-teal-700 uppercase">Thí sinh {idx + 1}</span>
                      <h3 className="text-lg font-bold text-slate-800">{player.name}</h3>
                      <span className="inline-flex items-center gap-1.5 text-xs text-teal-700 font-medium mt-1">
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" /> Đã sẵn sàng
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 w-full">
                    <span className="text-2xl block mb-1 opacity-40">⏳</span>
                    <span className="text-slate-400 text-xs font-medium">Đang chờ Thí sinh {idx + 1}...</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Gemini Questions Generator & MC Controls */}
        {role === 'admin' ? (
          <div className="space-y-5 bg-stone-100/70 border border-stone-200/80 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-teal-600 stroke-[1.75]" /> CẤU HÌNH BỘ CÂU HỎI
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Chủ đề hoặc lĩnh vực ưu tiên
              </label>
              <input
                type="text"
                placeholder="VD: Lịch sử Việt Nam, Khoa học vũ trụ, Văn hóa dân gian..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-teal-500 shadow-sm"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onStartGame(customTopic.trim())}
                disabled={room.players.length === 0 || !customTopic.trim() || isGenerating}
                className="flex-1 py-3.5 px-6 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-base shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Play className="w-5 h-5 fill-current" />
                {isGenerating ? 'GEMINI ĐANG TẠO CÂU HỎI...' : 'BẮT ĐẦU TRẬN THI ĐẤU'}
              </button>
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
    </div>
  );

};
