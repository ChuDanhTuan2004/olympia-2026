import React from 'react';
import { GameState, Role } from '../types';
import { Ban, Bell, Clock, HelpCircle, Shield, Users } from 'lucide-react';
import { sounds } from '../lib/audio';
import { MultipleChoiceAnswers } from './MultipleChoiceAnswers';

interface RoundWarmUpProps {
  room: GameState;
  role: Role;
  playerId?: string;
  onPressBuzzer: () => void;
  onSubmitAnswer?: (answer: string, actionType?: 'confirm' | 'skip') => void;
  onJudgeAnswer: (targetPlayerId: string, isCorrect: boolean, points: number, nextQuestion?: boolean) => void;
}

export const RoundWarmUp: React.FC<RoundWarmUpProps> = ({
  room,
  role,
  playerId,
  onPressBuzzer,
  onSubmitAnswer,
}) => {
  const warmupQuestions = room.questions?.warmup || [];
  const currentIdx = room.currentQuestionIndex;
  const q = warmupQuestions[currentIdx];

  const activeBuzzedPlayer = room.players.find((p) => p.id === room.activeBuzzer?.playerId);
  const isSelfBuzzed = activeBuzzedPlayer?.id === playerId;
  const warmupState = room.warmupState;
  const hasLostAnswerRight = Boolean(
    playerId && warmupState?.attemptedPlayerIds.includes(playerId)
  );
  const canPressBuzzer =
    warmupState?.phase === 'awaiting_buzzer' &&
    !room.activeBuzzer &&
    !room.buzzerLocked &&
    !hasLostAnswerRight;

  const handleBuzzerClick = () => {
    sounds.playBuzzer();
    onPressBuzzer();
  };

  if (!q) {
    return (
      <div className="text-center py-12 text-slate-400">
        Chưa có câu hỏi Khởi động. Chủ phòng vui lòng chọn chủ đề để Gemini AI soạn câu hỏi.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {warmupState?.phase === 'revealing' && warmupState.revealedAnswer && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-8 text-center text-black shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-black text-xl font-black text-white">
              {room.timerSeconds}
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              {warmupState.revealReason === 'no_buzzer'
                ? 'Không có thí sinh bấm chuông'
                : 'Tất cả thí sinh đã mất quyền trả lời'}
            </p>
            <h2 className="mt-3 text-2xl font-black uppercase">Đáp án đúng</h2>
            <div className="mt-4 rounded-2xl bg-neutral-100 px-5 py-4 text-2xl font-black">
              {warmupState.revealedAnswer}
            </div>
            <p className="mt-4 text-sm text-neutral-500">Tự động chuyển câu tiếp theo sau {room.timerSeconds} giây.</p>
          </div>
        </div>
      )}

      {/* Round Header Progress */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-stone-200/50 backdrop-blur-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">VÒNG 1</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800">KHỞI ĐỘNG</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-stone-100/80 border border-stone-200/80 px-4 py-2 rounded-2xl text-center">
            <span className="text-xs text-slate-500 uppercase block font-medium">Câu hỏi</span>
            <span className="font-mono font-bold text-teal-800 text-lg">
              {currentIdx + 1} / {warmupQuestions.length}
            </span>
          </div>
          <div className="bg-black px-4 py-2 rounded-2xl text-center text-white min-w-20">
            <span className="text-[10px] uppercase block font-medium text-neutral-400">
              {warmupState?.phase === 'answering' ? 'Trả lời' : 'Chờ chuông'}
            </span>
            <span className="font-mono font-black text-lg inline-flex items-center gap-1">
              <Clock className="h-4 w-4" /> {room.timerSeconds}s
            </span>
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-stone-200/60 backdrop-blur-md relative overflow-hidden">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 mb-3">
          <HelpCircle className="w-4 h-4 stroke-[1.75]" /> CÂU HỎI {currentIdx + 1} (10 ĐIỂM)
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 leading-relaxed mb-6">
          {q.question}
        </h3>

        {/* Secret Answer Key for Admin MC */}
        {role === 'admin' && (
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4 my-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal-800 mb-1">
              <Shield className="w-4 h-4 stroke-[1.75]" /> ĐÁP ÁN CHUẨN (MC):
            </div>
            <div className="text-lg font-extrabold text-teal-900">{q.answer}</div>
            {q.explanation && <p className="text-xs text-slate-600 mt-1">{q.explanation}</p>}
          </div>
        )}

        {/* Active Buzzer Notice */}
        {activeBuzzedPlayer ? (
          <div className="bg-teal-50 border border-teal-300 rounded-2xl p-4 text-center mb-6">
            <span className="text-xs uppercase tracking-wider font-bold text-teal-800 block mb-1">
              🔔 QUYỀN TRẢ LỜI THUỘC VỀ: {activeBuzzedPlayer.name.toUpperCase()}
            </span>
            <span className="text-sm font-black text-slate-800">Còn {room.timerSeconds} giây để trả lời</span>
          </div>
        ) : warmupState?.phase === 'awaiting_buzzer' ? (
          <div className="text-center py-2 text-xs text-slate-500 font-medium">
            Thí sinh còn quyền trả lời hãy bấm chuông trong {room.timerSeconds} giây!
          </div>
        ) : null}

        {/* Player Buzzer Action & Answer Input */}
        {role === 'player' && (
          <div className="mt-6 space-y-4">
            {canPressBuzzer && (
              <div className="flex justify-center">
                <button
                  onClick={handleBuzzerClick}
                  className="w-full max-w-sm py-5 px-8 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-teal-600/25 transition-all transform active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <Bell className="w-7 h-7 animate-bounce stroke-[1.75]" /> BẤM CHUÔNG!
                </button>
              </div>
            )}

            {hasLostAnswerRight && warmupState?.phase !== 'revealing' && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-neutral-100 p-4 text-center text-sm font-bold text-neutral-600">
                <Ban className="h-5 w-5" /> Bạn đã mất quyền trả lời câu hỏi này.
              </div>
            )}

            {!isSelfBuzzed && activeBuzzedPlayer && !hasLostAnswerRight && (
              <div className="rounded-2xl border border-neutral-300 bg-neutral-100 p-4 text-center text-sm font-bold text-neutral-600">
                {activeBuzzedPlayer.name} đang trả lời. Chuông tạm thời bị khóa.
              </div>
            )}

            {isSelfBuzzed && (
              <div className="bg-stone-50 border border-teal-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                <div className="text-xs font-bold text-teal-800 uppercase flex items-center gap-2">
                  <Bell className="w-4 h-4 animate-bounce text-teal-600 stroke-[1.75]" /> BẠN ĐÃ GIÀNH QUYỀN TRẢ LỜI! HÃY CHỌN A, B, C HOẶC D:
                </div>
                <MultipleChoiceAnswers
                  choices={q.choices}
                  onSelect={(answer) => onSubmitAnswer?.(answer, 'confirm')}
                />
              </div>
            )}
          </div>
        )}

        {/* Admin MC: Contestant Gameplay Progress Monitoring View */}
        {role === 'admin' && (
          <div className="mt-8 pt-6 border-t border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 stroke-[1.75]" /> QUÁ TRÌNH THI ĐẤU CỦA CÁC THÍ SINH
              </span>
              <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                Chấm điểm tự động
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {room.players.map((p, idx) => {
                const isBuzzed = room.activeBuzzer?.playerId === p.id;
                const isEliminated = warmupState?.attemptedPlayerIds.includes(p.id);

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
                          🔔 Đang trả lời...
                        </span>
                      ) : isEliminated ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-neutral-500 bg-neutral-100 border border-neutral-300 px-2.5 py-1 rounded-xl">
                          <Ban className="h-3 w-3" /> Mất quyền
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Còn quyền trả lời</span>
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
