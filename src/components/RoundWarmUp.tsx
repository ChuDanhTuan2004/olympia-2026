import React from 'react';
import { GameState, Role } from '../types';
import { Bell, CheckCircle2, ChevronRight, HelpCircle, Shield, SkipForward, Users } from 'lucide-react';
import { sounds } from '../lib/audio';

interface RoundWarmUpProps {
  room: GameState;
  role: Role;
  playerId?: string;
  onPressBuzzer: () => void;
  onSubmitAnswer?: (answer: string, actionType?: 'confirm' | 'skip') => void;
  onJudgeAnswer: (targetPlayerId: string, isCorrect: boolean, points: number, nextQuestion?: boolean) => void;
  onNextQuestion: () => void;
}

export const RoundWarmUp: React.FC<RoundWarmUpProps> = ({
  room,
  role,
  playerId,
  onPressBuzzer,
  onSubmitAnswer,
  onNextQuestion,
}) => {
  const warmupQuestions = room.questions?.warmup || [];
  const currentIdx = room.currentQuestionIndex % (warmupQuestions.length || 1);
  const q = warmupQuestions[currentIdx];

  const [answerInput, setAnswerInput] = React.useState('');

  const activeBuzzedPlayer = room.players.find((p) => p.id === room.activeBuzzer?.playerId);
  const isSelfBuzzed = activeBuzzedPlayer?.id === playerId;

  const handleBuzzerClick = () => {
    sounds.playBuzzer();
    onPressBuzzer();
  };

  const handleConfirmAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!answerInput.trim()) return;
    if (onSubmitAnswer) {
      onSubmitAnswer(answerInput.trim(), 'confirm');
    }
    setAnswerInput('');
  };

  const handleSkipQuestion = () => {
    if (onSubmitAnswer) {
      onSubmitAnswer('', 'skip');
    }
    setAnswerInput('');
  };

  if (!q) {
    return (
      <div className="text-center py-12 text-slate-400">
        Chưa có câu hỏi Khởi động. MC vui lòng chọn chủ đề để Gemini AI soạn câu hỏi.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Round Header Progress */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-stone-200/50 backdrop-blur-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">VÒNG 1</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800">KHỞI ĐỘNG</h2>
        </div>
        <div className="bg-stone-100/80 border border-stone-200/80 px-4 py-2 rounded-2xl text-center">
          <span className="text-xs text-slate-500 uppercase block font-medium">Câu hỏi</span>
          <span className="font-mono font-bold text-teal-800 text-lg">
            {currentIdx + 1} / {warmupQuestions.length}
          </span>
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
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-slate-500 font-medium">
            Thí sinh nhanh tay bấm chuông giành quyền trả lời!
          </div>
        )}

        {/* Player Buzzer Action & Answer Input */}
        {role === 'player' && (
          <div className="mt-6 space-y-4">
            {!room.activeBuzzer && (
              <div className="flex justify-center">
                <button
                  onClick={handleBuzzerClick}
                  disabled={room.buzzerLocked}
                  className="w-full max-w-sm py-5 px-8 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-teal-600/25 transition-all transform active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <Bell className="w-7 h-7 animate-bounce stroke-[1.75]" /> BẤM CHUÔNG!
                </button>
              </div>
            )}

            {isSelfBuzzed && (
              <div className="bg-stone-50 border border-teal-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                <div className="text-xs font-bold text-teal-800 uppercase flex items-center gap-2">
                  <Bell className="w-4 h-4 animate-bounce text-teal-600 stroke-[1.75]" /> BẠN ĐÃ GIÀNH QUYỀN TRẢ LỜI! HÃY NHẬP ĐÁP ÁN:
                </div>
                
                {/* Answer Input Box */}
                <input
                  type="text"
                  placeholder="Gõ đáp án của bạn tại đây..."
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-2xl px-4 py-3 text-slate-800 font-bold text-base focus:outline-none focus:border-teal-500 shadow-sm"
                  autoFocus
                />

                {/* 2 Buttons directly UNDER the answer input box */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSkipQuestion}
                    className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 border border-stone-300 transition-all active:scale-95 shadow-sm"
                  >
                    <SkipForward className="w-4 h-4 stroke-[1.75]" /> BỎ QUA
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAnswer}
                    disabled={!answerInput.trim()}
                    className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[1.75]" /> XÁC NHẬN
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
                <Users className="w-4 h-4 text-teal-600 stroke-[1.75]" /> QUÁ TRÌNH THI ĐẤU CỦA CÁC THÍ SINH
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
                          🔔 Đang trả lời...
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Sẵn sàng</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next Question Control */}
            <div className="flex justify-end mt-6">
              <button
                onClick={onNextQuestion}
                className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 transition-all shadow-md shadow-teal-600/20"
              >
                CÂU HỎI TIẾP THEO <ChevronRight className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
