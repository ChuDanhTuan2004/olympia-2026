import React, { useState } from 'react';
import { GameState, Role } from '../types';
import { Bell, KeyRound, Unlock, Shield, CheckCircle, XCircle, SkipForward, CheckCircle2, Users } from 'lucide-react';
import { sounds } from '../lib/audio';

interface RoundObstacleProps {
  room: GameState;
  role: Role;
  playerId?: string;
  onOpenClue: (clueNumber: number) => void;
  onPressBuzzer: () => void;
  onGuessKeyword: (keyword: string, actionType?: 'confirm' | 'skip') => void;
  onJudgeClue: (targetPlayerId: string, isCorrect: boolean) => void;
}

export const RoundObstacle: React.FC<RoundObstacleProps> = ({
  room,
  role,
  playerId,
  onOpenClue,
  onPressBuzzer,
  onGuessKeyword,
  onJudgeClue,
}) => {
  const obstacle = room.questions?.obstacle;
  const [keywordGuessInput, setKeywordGuessInput] = useState('');
  const [activeClueIndex, setActiveClueIndex] = useState<number | null>(null);

  if (!obstacle) {
    return <div className="text-center py-12 text-slate-400">Chưa có dữ liệu Vượt chướng ngại vật.</div>;
  }

  const handleBuzzerClick = () => {
    sounds.playBuzzer();
    onPressBuzzer();
  };

  const handleConfirmKeyword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!keywordGuessInput.trim()) return;
    onGuessKeyword(keywordGuessInput.trim(), 'confirm');
    setKeywordGuessInput('');
  };

  const handleSkipKeyword = () => {
    onGuessKeyword('', 'skip');
    setKeywordGuessInput('');
  };

  const activeBuzzedPlayer = room.players.find((p) => p.id === room.activeBuzzer?.playerId);
  const isSelfBuzzed = activeBuzzedPlayer?.id === playerId;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Round Header */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-stone-200/50 backdrop-blur-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">VÒNG 2</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800">VƯỢT CHƯỚNG NGẠI VẬT</h2>
        </div>
        <div className="bg-stone-100/80 border border-stone-200/80 px-4 py-2 rounded-2xl text-center">
          <span className="text-xs text-slate-500 uppercase block font-medium">Từ khóa gồm</span>
          <span className="font-mono font-black text-teal-800 text-lg">
            {obstacle.keywordLength} KÝ TỰ
          </span>
        </div>
      </div>

      {/* Secret Keyword Reveal Matrix */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-stone-200/60 backdrop-blur-md text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase text-teal-700 mb-4">
          <KeyRound className="w-4 h-4 stroke-[1.75]" /> CHƯỚNG NGẠI VẬT CẦN TÌM
        </div>

        <div className="flex flex-wrap justify-center gap-2 my-4">
          {obstacle.keyword.split('').map((char, idx) => {
            const isSpace = char === ' ';
            const isRevealed = obstacle.isKeywordRevealed;

            if (isSpace) {
              return <div key={idx} className="w-6 h-10" />;
            }

            return (
              <div
                key={idx}
                className={`w-9 h-11 sm:w-11 sm:h-14 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-black font-mono shadow-sm border transition-all ${
                  isRevealed
                    ? 'bg-teal-600 text-white border-teal-500 scale-105 shadow-md'
                    : 'bg-stone-100 border-stone-200 text-slate-400'
                }`}
              >
                {isRevealed ? char : '?'}
              </div>
            );
          })}
        </div>

        {obstacle.isKeywordRevealed && (
          <div className="mt-4 p-3.5 bg-teal-50 border border-teal-200 rounded-2xl text-teal-800 font-bold text-sm">
            🎉 CHƯỚNG NGẠI VẬT ĐÃ ĐƯỢC GIẢI MÃ: {obstacle.keyword}
          </div>
        )}

        {/* Secret Admin Answer Key */}
        {role === 'admin' && (
          <div className="mt-4 p-3 bg-stone-100/80 border border-stone-200 rounded-2xl text-xs text-slate-600 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 stroke-[1.75] text-teal-700" /> Từ khóa chuẩn MC: <span className="font-bold text-teal-800">{obstacle.keyword}</span>
          </div>
        )}
      </div>

      {/* 4 Clue Rows */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/50 space-y-4">
        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">CÁC HÀNG NGANG GỢI Ý</h3>

        {obstacle.clues.map((clue) => {
          const isOpened = clue.isOpened;
          const isSelected = activeClueIndex === clue.number;

          return (
            <div
              key={clue.number}
              className={`p-4 rounded-2xl border transition-all ${
                isOpened
                  ? 'bg-teal-50/80 border-teal-200 text-teal-900'
                  : 'bg-stone-50/70 border-stone-200/80 text-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-white font-mono font-bold text-teal-700 flex items-center justify-center text-sm border border-stone-200 shadow-sm">
                    {clue.number}
                  </span>
                  <span className="font-semibold text-sm">Hàng ngang {clue.number} ({clue.letterCount} chữ cái)</span>
                </div>

                {role === 'admin' && !isOpened && (
                  <button
                    onClick={() => {
                      onOpenClue(clue.number);
                      setActiveClueIndex(clue.number);
                    }}
                    className="py-1.5 px-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Unlock className="w-3.5 h-3.5 stroke-[1.75]" /> MỞ CÂU HỎI
                  </button>
                )}
              </div>

              {/* Opened Clue Question Text */}
              {isOpened && (
                <div className="mt-3 pt-3 border-t border-teal-200/60">
                  <p className="text-sm font-bold text-slate-800 mb-1">{clue.question}</p>
                  {role === 'admin' && (
                    <span className="text-xs text-teal-800 font-mono">Đáp án: {clue.answer}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contestant Guess Keyword Form */}
      {role === 'player' && !obstacle.isKeywordRevealed && (
        <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-stone-200/60 backdrop-blur-md">
          {activeBuzzedPlayer ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-teal-50 border border-teal-300 rounded-2xl text-center text-teal-800 text-xs font-bold uppercase animate-pulse">
                🔔 {activeBuzzedPlayer.name.toUpperCase()} ĐANG GIÀNH QUYỀN TRẢ LỜI CNV
              </div>

              {isSelfBuzzed && (
                <div className="bg-stone-50 border border-teal-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                  <div className="text-xs font-bold text-teal-800 uppercase flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-teal-600 stroke-[1.75]" /> HÃY NHẬP TỪ KHÓA HOẶC CÂU TRẢ LỜI:
                  </div>

                  {/* Input Box */}
                  <input
                    type="text"
                    placeholder="Nhập từ khóa hoặc đáp án..."
                    value={keywordGuessInput}
                    onChange={(e) => setKeywordGuessInput(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-2xl px-4 py-3 text-slate-800 font-bold text-base uppercase focus:outline-none focus:border-teal-500 shadow-sm"
                    autoFocus
                  />

                  {/* 2 Buttons directly UNDER the input box */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleSkipKeyword}
                      className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 border border-stone-300 transition-all active:scale-95 shadow-sm"
                    >
                      <SkipForward className="w-4 h-4 stroke-[1.75]" /> BỎ QUA
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmKeyword}
                      disabled={!keywordGuessInput.trim()}
                      className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[1.75]" /> XÁC NHẬN
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={handleBuzzerClick}
                disabled={room.buzzerLocked}
                className="w-full py-4 px-6 bg-teal-600 hover:bg-teal-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-teal-600/25 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                <Bell className="w-6 h-6 animate-bounce stroke-[1.75]" /> BẤM CHUÔNG TRẢ LỜI CHƯỚNG NGẠI VẬT
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin MC Keyword Judging & Gameplay Monitoring */}
      {role === 'admin' && (
        <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/50 space-y-6">
          {activeBuzzedPlayer && !obstacle.isKeywordRevealed && (
            <div className="bg-stone-100/80 border border-stone-200/80 rounded-2xl p-4 text-center space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase">
                ĐÁNH GIÁ ĐOÁN CHƯỚNG NGẠI VẬT CỦA {activeBuzzedPlayer.name.toUpperCase()}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    sounds.playCorrect();
                    onJudgeClue(activeBuzzedPlayer.id, true);
                  }}
                  className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm flex items-center gap-2 shadow-md"
                >
                  <CheckCircle className="w-4 h-4 stroke-[1.75]" /> CHÍNH XÁC (GIẢI CNV + ĐIỂM)
                </button>
                <button
                  onClick={() => {
                    sounds.playWrong();
                    onJudgeClue(activeBuzzedPlayer.id, false);
                  }}
                  className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm flex items-center gap-2 shadow-md"
                >
                  <XCircle className="w-4 h-4 stroke-[1.75]" /> KHÔNG CHÍNH XÁC
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600 stroke-[1.75]" /> QUÁ TRÌNH THI ĐẤU CỦA THÍ SINH (CNV)
            </span>
            <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              Chấm điểm tự động
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {room.players.map((p, idx) => {
              const isBuzzed = room.activeBuzzer?.playerId === p.id;

              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    isBuzzed
                      ? 'bg-teal-50 border-teal-300 shadow-sm'
                      : 'bg-stone-50/80 border-stone-200/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.avatar}</span>
                    <div>
                      <div className="font-bold text-sm text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500 font-mono">#{idx + 1} • {p.score} điểm</div>
                    </div>
                  </div>
                  <div>
                    {isBuzzed ? (
                      <span className="text-xs font-bold text-teal-800 bg-white border border-teal-300 px-2.5 py-1 rounded-xl shadow-xs animate-pulse">
                        🔔 Đang suy nghĩ...
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Chưa bấm</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
