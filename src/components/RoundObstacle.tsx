import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, KeyRound, LockKeyhole, Send, Shield, Unlock } from 'lucide-react';
import { GameState, Role } from '../types';
import { sounds } from '../lib/audio';

interface RoundObstacleProps {
  room: GameState;
  role: Role;
  playerId?: string;
  onOpenClue: (clueNumber: number) => void;
  onPressBuzzer: () => void;
  onSubmitClueAnswer: (answer: string) => void;
  onGuessKeyword: (keyword: string, actionType?: 'confirm' | 'skip') => void;
}

export const RoundObstacle: React.FC<RoundObstacleProps> = ({
  room,
  role,
  playerId,
  onOpenClue,
  onPressBuzzer,
  onSubmitClueAnswer,
  onGuessKeyword,
}) => {
  const obstacle = room.questions?.obstacle;
  const state = room.obstacleState;
  const [clueAnswer, setClueAnswer] = useState('');
  const [keywordGuess, setKeywordGuess] = useState('');
  const currentClueRef = useRef<HTMLElement>(null);

  const currentClue = obstacle?.clues.find(
    (clue) => Number(clue.number) === Number(state?.currentClueIndex)
  );
  const selectorId = state?.selectionOrder?.[state.selectionTurnIndex];
  const selector = room.players.find((player) => player.id === selectorId);
  const activeBuzzedPlayer = room.players.find(
    (player) => player.id === room.activeBuzzer?.playerId
  );
  const isSelfBuzzed = activeBuzzedPlayer?.id === playerId;
  const isEliminated = Boolean(
    playerId && state?.eliminatedPlayerIds?.includes(playerId)
  );
  const ownSubmission = state?.clueSubmissions?.find(
    (submission) => submission.playerId === playerId
  );

  useEffect(() => {
    setClueAnswer('');
  }, [state?.currentClueIndex]);

  useEffect(() => {
    if (role !== 'player' || !currentClue || state?.phase === 'selecting_clue') return;

    const animationFrame = window.requestAnimationFrame(() => {
      currentClueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [role, state?.currentClueIndex, state?.phase]);

  if (!obstacle || !state) {
    return <div className="py-12 text-center text-neutral-500">Chưa có dữ liệu Vượt chướng ngại vật.</div>;
  }

  const canBuzz =
    role === 'player' &&
    !isEliminated &&
    !obstacle.isKeywordRevealed &&
    !activeBuzzedPlayer &&
    state.phase !== 'keyword_answering' &&
    state.phase !== 'revealing_keyword';

  const submitClue = (event: React.FormEvent) => {
    event.preventDefault();
    const answer = clueAnswer.trim();
    if (!answer) return;
    onSubmitClueAnswer(answer);
    setClueAnswer('');
  };

  const submitKeyword = (event: React.FormEvent) => {
    event.preventDefault();
    const answer = keywordGuess.trim();
    if (!answer) return;
    onGuessKeyword(answer);
    setKeywordGuess('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-center justify-between rounded-3xl border border-neutral-200 bg-white p-5 shadow-lg">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Vòng 2</span>
          <h2 className="text-xl font-black text-black sm:text-2xl">VƯỢT CHƯỚNG NGẠI VẬT</h2>
        </div>
        <div className="rounded-2xl bg-black px-4 py-2 text-center text-white">
          <span className="block text-[10px] uppercase text-neutral-300">Thời gian</span>
          <span className="font-mono text-xl font-black">{room.timerSeconds}s</span>
        </div>
      </header>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 text-center shadow-lg">
        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-bold uppercase text-neutral-600">
          <KeyRound className="h-4 w-4" /> Chướng ngại vật · {obstacle.keywordLength} ký tự
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {obstacle.keyword.split('').map((character, index) =>
            character === ' ' ? (
              <div key={index} className="w-5" />
            ) : (
              <div
                key={index}
                className="flex h-12 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 font-mono text-xl font-black text-black"
              >
                {obstacle.isKeywordRevealed ? character : '?'}
              </div>
            )
          )}
        </div>
        {obstacle.isKeywordRevealed && (
          <div className="mt-4 rounded-2xl bg-black p-3 font-bold text-white">
            ĐÁP ÁN: {obstacle.keyword}
          </div>
        )}
        {role === 'admin' && !obstacle.isKeywordRevealed && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
            <Shield className="h-4 w-4" /> Đáp án dành cho MC: <strong>{obstacle.keyword}</strong>
          </div>
        )}
      </section>

      {role === 'player' && !obstacle.isKeywordRevealed && (
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-lg">
          {isEliminated ? (
            <div className="rounded-2xl bg-neutral-100 p-4 text-center text-sm font-semibold text-neutral-600">
              Bạn đã mất quyền đoán chướng ngại vật và trả lời các hàng ngang còn lại.
            </div>
          ) : activeBuzzedPlayer ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-black p-3 text-center text-xs font-bold uppercase text-white">
                {activeBuzzedPlayer.name} đang có 30 giây trả lời chướng ngại vật
              </div>
              {isSelfBuzzed && (
                <form onSubmit={submitKeyword} className="space-y-3">
                  <input
                    value={keywordGuess}
                    onChange={(event) => setKeywordGuess(event.target.value)}
                    placeholder="Nhập đáp án chướng ngại vật"
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 font-medium outline-none focus:border-black"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => onGuessKeyword('', 'skip')}
                      className="flex-1 rounded-2xl border border-neutral-300 py-3 font-semibold"
                    >
                      Bỏ qua
                    </button>
                    <button
                      disabled={!keywordGuess.trim()}
                      className="flex-1 rounded-2xl bg-black py-3 font-bold text-white disabled:opacity-40"
                    >
                      Xác nhận
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                sounds.playBuzzer();
                onPressBuzzer();
              }}
              disabled={!canBuzz}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-6 py-4 text-lg font-black text-white disabled:opacity-40"
            >
              <Bell className="h-6 w-6" /> BẤM CHUÔNG TRẢ LỜI CHƯỚNG NGẠI VẬT
            </button>
          )}
          {state.phase === 'final_keyword_window' && (
            <p className="mt-3 text-center text-xs font-semibold text-neutral-500">
              Đã chọn đủ 4 hàng ngang. Còn {room.timerSeconds} giây để giành quyền trả lời.
            </p>
          )}
        </section>
      )}

      {role === 'player' && currentClue && state.phase !== 'selecting_clue' && (
        <>
          <span ref={currentClueRef} />
        <section className="rounded-3xl border-2 border-black bg-white p-5 shadow-xl">
          <div className="mb-3 text-xs font-bold uppercase text-neutral-500">
            Hàng ngang {currentClue.number} · Tất cả thí sinh cùng trả lời
          </div>
          <p className="mb-4 text-lg font-bold text-black">{currentClue.question}</p>
          {isEliminated ? null : ownSubmission ? (
            <div className="rounded-2xl bg-neutral-100 p-4 text-center text-sm font-semibold">
              <CheckCircle2 className="mr-2 inline h-4 w-4" /> Bạn đã gửi đáp án.
            </div>
          ) : state.phase === 'keyword_answering' ? (
            <div className="rounded-2xl bg-neutral-100 p-4 text-center text-sm">
              Câu hỏi đang tạm dừng trong lúc một thí sinh đoán chướng ngại vật.
            </div>
          ) : state.phase === 'answering_clue' ? (
            <form onSubmit={submitClue} className="flex gap-3">
              <input
                value={clueAnswer}
                onChange={(event) => setClueAnswer(event.target.value)}
                placeholder="Nhập câu trả lời"
                className="min-w-0 flex-1 rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
                autoFocus
              />
              <button
                disabled={!clueAnswer.trim()}
                className="flex items-center gap-2 rounded-2xl bg-black px-5 font-bold text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> Gửi
              </button>
            </form>
          ) : null}
          </section>
        </>
      )}

      <section className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase text-neutral-500">Các hàng ngang gợi ý</h3>
          {state.phase === 'selecting_clue' && selector && (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">
              Lượt chọn: {selector.name} · {selector.score} điểm
            </span>
          )}
        </div>

        {obstacle.clues.map((clue) => {
          const canSelect =
            role === 'player' &&
            playerId === selectorId &&
            state.phase === 'selecting_clue' &&
            !isEliminated &&
            !clue.isOpened;

          return (
            <div
              key={clue.number}
              className={`rounded-2xl border p-4 ${
                clue.isOpened ? 'border-black bg-neutral-50' : 'border-neutral-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black font-mono font-bold text-white">
                    {clue.number}
                  </span>
                  <div>
                    <div className="text-sm font-bold">Hàng ngang {clue.number}</div>
                    <div className="text-xs text-neutral-500">{clue.letterCount} chữ cái</div>
                  </div>
                </div>
                {canSelect ? (
                  <button
                    onClick={() => onOpenClue(clue.number)}
                    className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white"
                  >
                    <Unlock className="h-4 w-4" /> Chọn
                  </button>
                ) : clue.isOpened ? (
                  <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold">
                    Đã chọn
                  </span>
                ) : (
                  <LockKeyhole className="h-4 w-4 text-neutral-400" />
                )}
              </div>

              {clue.isOpened && (
                <div className="mt-3 border-t border-neutral-200 pt-3">
                  <p className="text-sm font-semibold">{clue.question}</p>
                  <div className="mt-2 rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold">
                    {clue.isAnswered ? clue.answer : '?'.repeat(Math.max(1, clue.letterCount))}
                  </div>
                  {role === 'admin' && !clue.isAnswered && (
                    <div className="mt-1 text-xs text-neutral-500">Đáp án MC: {clue.answer}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
};
