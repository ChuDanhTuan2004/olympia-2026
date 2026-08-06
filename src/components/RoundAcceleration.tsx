import React, { useState } from 'react';
import { GameState, Role } from '../types';
import { Zap, Clock, Shield, CheckCircle2, HelpCircle, Users } from 'lucide-react';
import { sounds } from '../lib/audio';
import { MultipleChoiceAnswers } from './MultipleChoiceAnswers';

interface RoundAccelerationProps {
  room: GameState;
  role: Role;
  playerId?: string;
  onSubmitAnswer: (answer: string, actionType?: 'confirm' | 'skip') => void;
  onJudgeAnswer: (targetPlayerId: string, isCorrect: boolean, points: number, nextQuestion?: boolean) => void;
}

export const RoundAcceleration: React.FC<RoundAccelerationProps> = ({
  room,
  role,
  playerId,
  onSubmitAnswer,
  onJudgeAnswer,
}) => {
  const accelQuestions = room.questions?.acceleration || [];
  const currentIdx = room.currentQuestionIndex % (accelQuestions.length || 1);
  const q = accelQuestions[currentIdx];

  const [hasSubmitted, setHasSubmitted] = useState(false);

  React.useEffect(() => {
    setHasSubmitted(false);
  }, [room.currentQuestionIndex]);

  if (!q) {
    return <div className="text-center py-12 text-slate-400">Chưa có dữ liệu Vòng Tăng Tốc.</div>;
  }

  const handleChoiceSelect = (answer: string) => {
    if (hasSubmitted) return;
    sounds.playTick();
    onSubmitAnswer(answer, 'confirm');
    setHasSubmitted(true);
  };

  const submissions = room.accelerationState?.playerSubmissions || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Round Header */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-stone-200/50 backdrop-blur-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">VÒNG 3</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-teal-600 fill-teal-600 animate-pulse stroke-[1.75]" /> TĂNG TỐC
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-stone-100/80 border border-stone-200/80 px-4 py-2 rounded-2xl text-center flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-700 stroke-[1.75]" />
            <span className="font-mono font-black text-teal-800 text-xl">{room.timerSeconds}s</span>
          </div>
          <div className="bg-stone-100/80 border border-stone-200/80 px-3.5 py-2 rounded-2xl text-center">
            <span className="text-xs text-slate-500 uppercase block font-medium">Câu</span>
            <span className="font-mono font-bold text-teal-800 text-sm">
              {currentIdx + 1} / 4
            </span>
          </div>
        </div>
      </div>

      {/* Main Question Box */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-stone-200/60 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700 mb-3">
          <HelpCircle className="w-4 h-4 stroke-[1.75]" /> CÂU HỎI TĂNG TỐC {currentIdx + 1} (40/30 ĐIỂM)
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 leading-relaxed mb-6">
          {q.question}
        </h3>

        {/* Secret Answer Key for Admin */}
        {role === 'admin' && (
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4 my-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal-800 mb-1">
              <Shield className="w-4 h-4 stroke-[1.75]" /> ĐÁP ÁN ĐÚNG (MC):
            </div>
            <div className="text-lg font-black text-teal-900">{q.answer}</div>
          </div>
        )}

        {/* Contestant Submission Form */}
        {role === 'player' && (
          <div className="mt-6">
            {!hasSubmitted ? (
              <div className="bg-stone-50 border border-teal-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                <div className="text-xs font-bold text-teal-800 uppercase flex items-center gap-2">
                  <Zap className="w-4 h-4 text-teal-600 stroke-[1.75]" /> CHỌN NHANH ĐÁP ÁN A, B, C HOẶC D:
                </div>
                <MultipleChoiceAnswers
                  choices={q.choices}
                  onSelect={handleChoiceSelect}
                  disabled={room.timerSeconds === 0}
                />
              </div>
            ) : (
              <div className="bg-teal-50 border border-teal-300 rounded-2xl p-4 text-center text-teal-800 font-bold text-sm shadow-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600 stroke-[1.75]" /> Đã nộp/xác nhận đáp án thành công. Đang tự động chấm điểm!
              </div>
            )}
          </div>
        )}

        {/* Live Submissions Table for Admin */}
        {role === 'admin' && (
          <div className="mt-6 bg-stone-100/80 border border-stone-200 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">ĐÁP ÁN TÍNH THEO TỐC ĐỘ NỘP</h4>
            {submissions.length === 0 ? (
              <p className="text-xs text-slate-500 py-2 text-center">Chưa có thí sinh nào nộp đáp án.</p>
            ) : (
              <div className="space-y-2">
                {submissions.map((sub, idx) => {
                  const player = room.players.find((p) => p.id === sub.playerId);
                  const defaultPts = idx === 0 ? 40 : 30;

                  return (
                    <div
                      key={sub.playerId}
                      className="flex items-center justify-between p-3 bg-white rounded-2xl border border-stone-200 shadow-sm"
                    >
                      <div>
                        <span className="text-xs text-teal-700 font-mono font-bold mr-2">#{idx + 1}</span>
                        <span className="text-sm font-bold text-slate-800 mr-3">{player?.name}</span>
                        <span className="text-sm font-mono text-teal-900 bg-stone-100 px-2 py-0.5 rounded-xl border border-stone-200">
                          "{sub.answer}"
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            sounds.playCorrect();
                            onJudgeAnswer(sub.playerId, true, defaultPts);
                          }}
                          className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm"
                        >
                          ĐÚNG (+{defaultPts}đ)
                        </button>
                        <button
                          onClick={() => {
                            sounds.playWrong();
                            onJudgeAnswer(sub.playerId, false, 0);
                          }}
                          className="py-1 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm"
                        >
                          SAI (0đ)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
