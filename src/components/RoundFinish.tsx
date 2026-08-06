import React, { useState } from 'react';
import { GameState, Role, FinishQuestion } from '../types';
import { Star, Bell, Shield, CheckCircle2, XCircle, HelpCircle, SkipForward, Users } from 'lucide-react';
import { sounds } from '../lib/audio';

interface RoundFinishProps {
  room: GameState;
  role: Role;
  playerId?: string;
  onToggleStarOfHope: () => void;
  onPressBuzzer: () => void;
  onSubmitAnswer: (answer: string, actionType?: 'confirm' | 'skip') => void;
  onJudgeAnswer: (targetPlayerId: string, isCorrect: boolean, points: number, deduct?: boolean) => void;
}

export const RoundFinish: React.FC<RoundFinishProps> = ({
  room,
  role,
  playerId,
  onToggleStarOfHope,
  onPressBuzzer,
  onSubmitAnswer,
  onJudgeAnswer,
}) => {
  const finishState = room.finishState;
  const activeTurnPlayer = room.players.find((p) => p.id === finishState?.activeTurnPlayerId) || room.players[0];
  const activePlayerIdx = Math.max(0, room.players.findIndex((p) => p.id === activeTurnPlayer?.id));
  const packageKey = `player${activePlayerIdx + 1}Package`;

  const questions: FinishQuestion[] = (room.questions?.finish as any)?.[packageKey] || room.questions?.finish.player1Package || [];

  const currentQuestionIdx = finishState?.questionIndex || 0;
  const currentQ = questions[currentQuestionIdx];

  const [answerInput, setAnswerInput] = useState('');

  if (!currentQ || !activeTurnPlayer) {
    return <div className="text-center py-12 text-slate-400">Chưa có dữ liệu Vòng Về Đích.</div>;
  }

  const isMainPlayer = playerId === activeTurnPlayer.id;
  const isStealerPlayer = playerId !== activeTurnPlayer.id;
  const isStarActive = finishState?.starOfHopeActive || false;

  const basePoints = currentQ.pointValue;
  const finalWinPoints = isStarActive ? basePoints * 2 : basePoints;
  const finalLossPoints = isStarActive ? Math.round(basePoints / 2) : 0;

  const handleToggleStar = () => {
    sounds.playStarOfHope();
    onToggleStarOfHope();
  };

  const handleBuzzerClick = () => {
    sounds.playBuzzer();
    onPressBuzzer();
  };

  const handleConfirmSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!answerInput.trim()) return;
    onSubmitAnswer(answerInput.trim(), 'confirm');
    setAnswerInput('');
  };

  const handleSkipSubmit = () => {
    onSubmitAnswer('', 'skip');
    setAnswerInput('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Round Header */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-stone-200/50 backdrop-blur-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">VÒNG 4</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800">VỀ ĐÍCH</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-stone-100/80 border border-stone-200/80 px-3.5 py-1.5 rounded-2xl text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-medium">Lượt thi của</span>
            <span className="font-bold text-teal-800 text-sm">{activeTurnPlayer.name}</span>
          </div>
          <div className="bg-stone-100/80 border border-stone-200/80 px-3.5 py-1.5 rounded-2xl text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-medium">Câu</span>
            <span className="font-mono font-bold text-teal-800 text-sm">{currentQuestionIdx + 1} / 3</span>
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-stone-200/60 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal-700">
            <HelpCircle className="w-4 h-4 stroke-[1.75]" /> CÂU HỎI {basePoints} ĐIỂM
          </div>

          {/* Star of Hope Status Badge */}
          {isStarActive && (
            <div className="bg-teal-600 text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 animate-pulse">
              <Star className="w-4 h-4 fill-current text-white stroke-[1.75]" /> NGÔI SAO HY VỌNG (+{finalWinPoints}đ / -{finalLossPoints}đ)
            </div>
          )}
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 leading-relaxed mb-6">
          {currentQ.question}
        </h3>

        {/* Secret Answer Key for Admin MC */}
        {role === 'admin' && (
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4 my-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal-800 mb-1">
              <Shield className="w-4 h-4 stroke-[1.75]" /> ĐÁP ÁN CHUẨN (MC):
            </div>
            <div className="text-lg font-black text-teal-900">{currentQ.answer}</div>
            {currentQ.explanation && <p className="text-xs text-slate-600 mt-1">{currentQ.explanation}</p>}
          </div>
        )}

        {/* Star of Hope Toggle Button for Active Player */}
        {role === 'player' && isMainPlayer && (
          <div className="flex justify-center my-4">
            <button
              onClick={handleToggleStar}
              className={`py-2.5 px-6 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-md ${
                isStarActive
                  ? 'bg-teal-600 text-white'
                  : 'bg-stone-100 text-teal-800 border border-stone-200 hover:bg-stone-200/80'
              }`}
            >
              <Star className={`w-4 h-4 stroke-[1.75] ${isStarActive ? 'fill-current' : ''}`} />
              {isStarActive ? 'ĐÃ BẬT NGÔI SAO HY VỌNG' : 'BẬT NGÔI SAO HY VỌNG'}
            </button>
          </div>
        )}

        {/* Display Submitted Answers */}
        {(finishState?.mainPlayerAnswer || finishState?.stealerAnswer) && (
          <div className="my-4 space-y-2">
            {finishState?.mainPlayerAnswer && (
              <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 text-[13px] text-slate-700 flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-bold text-teal-800">💬 {activeTurnPlayer.name} trả lời:</span>{' '}
                  <span className="text-slate-900 font-mono font-bold text-base">"{finishState.mainPlayerAnswer}"</span>
                </div>
                <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold uppercase">Thí sinh chính</span>
              </div>
            )}
            {finishState?.stealerAnswer && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-[13px] text-slate-700 flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-bold text-red-700">
                    🔔 {room.players.find((p) => p.id === finishState?.stealerPlayerId)?.name || 'Thí sinh cướp điểm'} trả lời:
                  </span>{' '}
                  <span className="text-red-900 font-mono font-bold text-base">"{finishState.stealerAnswer}"</span>
                </div>
                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold uppercase">Cướp điểm</span>
              </div>
            )}
          </div>
        )}

        {/* Main Player Answer Form */}
        {role === 'player' && isMainPlayer && (
          <div className="mt-6 bg-stone-50 border border-teal-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
            <div className="text-xs font-bold text-teal-800 uppercase flex items-center gap-2">
              <span>💬 LƯỢT CHÍNH CỦA BẠN - HÃY NHẬP ĐÁP ÁN:</span>
            </div>

            {/* Input Box */}
            <input
              type="text"
              placeholder="Nhập câu trả lời của bạn..."
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-2xl px-4 py-3 text-slate-800 font-bold text-base focus:outline-none focus:border-teal-500 shadow-sm"
              autoFocus
            />

            {/* 2 Buttons directly UNDER the input box */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleSkipSubmit}
                className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 border border-stone-300 transition-all active:scale-95 shadow-sm"
              >
                <SkipForward className="w-4 h-4 stroke-[1.75]" /> BỎ QUA
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={!answerInput.trim()}
                className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[1.75]" /> XÁC NHẬN
              </button>
            </div>
          </div>
        )}

        {/* Stealer Player Buzzer & Answer Form */}
        {role === 'player' && isStealerPlayer && (
          <div className="mt-6 space-y-3">
            {room.activeBuzzer?.playerId === playerId ? (
              <div className="bg-stone-50 border border-red-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                <div className="text-xs font-bold text-red-700 uppercase flex items-center gap-2">
                  <Bell className="w-4 h-4 animate-bounce text-red-600 stroke-[1.75]" /> BẠN ĐÃ GIÀNH QUYỀN CƯỚP ĐIỂM! HÃY NHẬP CÂU TRẢ LỜI:
                </div>

                {/* Input Box */}
                <input
                  type="text"
                  placeholder="Nhập đáp án cướp điểm..."
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-2xl px-4 py-3 text-slate-800 font-bold text-base focus:outline-none focus:border-red-500 shadow-sm"
                  autoFocus
                />

                {/* 2 Buttons directly UNDER the input box */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSkipSubmit}
                    className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 border border-stone-300 transition-all active:scale-95 shadow-sm"
                  >
                    <SkipForward className="w-4 h-4 stroke-[1.75]" /> BỎ QUA
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={!answerInput.trim()}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[1.75]" /> XÁC NHẬN
                  </button>
                </div>
              </div>
            ) : room.activeBuzzer ? (
              <div className="p-4 bg-stone-100 border border-stone-200 rounded-2xl text-center space-y-1">
                <div className="text-xs font-bold text-teal-800 uppercase">
                  🔔 THÍ SINH {room.activeBuzzer.playerName.toUpperCase()} ĐÃ BẤM CHUÔNG CƯỚP ĐIỂM!
                </div>
                {finishState?.stealerAnswer ? (
                  <div className="text-base font-black text-slate-800 font-mono">
                    "{finishState.stealerAnswer}"
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic animate-pulse">
                    Thí sinh đang nhập đáp án cướp điểm...
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
                  <Bell className="w-6 h-6 animate-bounce stroke-[1.75]" /> BẤM CHUÔNG GIÀNH QUYỀN CƯỚP ĐIỂM!
                </button>
              </div>
            )}
          </div>
        )}

        {/* Admin MC Judging Controls */}
        {role === 'admin' && (
          <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-4 mt-6 space-y-4">
            <div className="text-xs font-semibold text-slate-600 text-center">
              MC CHẤM ĐIỂM CÂU HỎI VỀ ĐÍCH CỦA {activeTurnPlayer.name.toUpperCase()}:
            </div>

            {/* Main Player Judging */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => {
                  sounds.playCorrect();
                  onJudgeAnswer(activeTurnPlayer.id, true, finalWinPoints, false);
                }}
                className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm flex items-center gap-2 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[1.75]" /> {activeTurnPlayer.name}: ĐÚNG (+{finalWinPoints}đ)
              </button>
              <button
                onClick={() => {
                  sounds.playWrong();
                  onJudgeAnswer(activeTurnPlayer.id, false, finalLossPoints, true);
                }}
                className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm flex items-center gap-2 shadow-md"
              >
                <XCircle className="w-4 h-4 stroke-[1.75]" /> {activeTurnPlayer.name}: SAI (-{finalLossPoints}đ)
              </button>
            </div>

            {/* Stealer Player Judging if buzzed */}
            {(finishState?.stealerPlayerId || room.activeBuzzer) && (
              <div className="pt-3 border-t border-stone-200">
                <div className="text-xs font-bold text-red-700 text-center mb-2">
                  CHẤM ĐIỂM CƯỚP ĐIỂM CỦA {room.players.find((p) => p.id === (finishState?.stealerPlayerId || room.activeBuzzer?.playerId))?.name.toUpperCase()}:
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => {
                      const stealerId = finishState?.stealerPlayerId || room.activeBuzzer?.playerId;
                      if (stealerId) {
                        sounds.playCorrect();
                        onJudgeAnswer(stealerId, true, basePoints, false);
                      }
                    }}
                    className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[1.75]" /> CƯỚP ĐIỂM ĐÚNG (+{basePoints}đ)
                  </button>
                  <button
                    onClick={() => {
                      const stealerId = finishState?.stealerPlayerId || room.activeBuzzer?.playerId;
                      if (stealerId) {
                        sounds.playWrong();
                        onJudgeAnswer(stealerId, false, Math.round(basePoints / 2), true);
                      }
                    }}
                    className="py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <XCircle className="w-4 h-4 stroke-[1.75]" /> CƯỚP ĐIỂM SAI (-{Math.round(basePoints / 2)}đ)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin MC: Contestant Gameplay Progress Monitoring View */}
        {role === 'admin' && (
          <div className="mt-8 pt-6 border-t border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 stroke-[1.75]" /> QUÁ TRÌNH THI ĐẤU CỦA THÍ SINH (VỀ ĐÍCH)
              </span>
              <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                Chấm điểm tự động
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {room.players.map((p, idx) => {
                const isMain = p.id === activeTurnPlayer.id;
                const isStealer = p.id === finishState?.stealerPlayerId || room.activeBuzzer?.playerId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isMain
                        ? 'bg-teal-50 border-teal-300 shadow-sm'
                        : isStealer
                        ? 'bg-red-50 border-red-300 shadow-sm'
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
                      {isMain ? (
                        <span className="text-xs font-bold text-teal-800 bg-white border border-teal-300 px-2.5 py-1 rounded-xl shadow-xs">
                          🎯 Lượt chính
                        </span>
                      ) : isStealer ? (
                        <span className="text-xs font-bold text-red-700 bg-white border border-red-300 px-2.5 py-1 rounded-xl shadow-xs animate-pulse">
                          🔔 Cướp điểm
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Sẵn sàng</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
