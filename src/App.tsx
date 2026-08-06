import React, { useEffect, useState, useRef } from 'react';
import { GameState, Role, WSMessage } from './types';
import { Header } from './components/Header';
import { Lobby } from './components/Lobby';
import { RoundWarmUp } from './components/RoundWarmUp';
import { RoundObstacle } from './components/RoundObstacle';
import { RoundAcceleration } from './components/RoundAcceleration';
import { RoundFinish } from './components/RoundFinish';
import { VictoryModal } from './components/VictoryModal';
import { AdminControlDrawer } from './components/AdminControlDrawer';
import { TopNavControls } from './components/TopNavControls';
import { RulesModal } from './components/RulesModal';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function App() {
  const [room, setRoom] = useState<GameState | null>(null);
  const [role, setRole] = useState<Role>('spectator');
  const [playerId, setPlayerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; pointsAwarded: number } | null>(null);

  // Rules Modal State
  const [showRulesModal, setShowRulesModal] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const shownAnswerResultTimestamp = useRef<number>();

  const playerAnswerResult = room?.players.find((player) => player.id === playerId)?.lastAnswerResult;

  useEffect(() => {
    if (
      role !== 'player' ||
      !playerAnswerResult ||
      shownAnswerResultTimestamp.current === playerAnswerResult.timestamp
    ) {
      return;
    }

    shownAnswerResultTimestamp.current = playerAnswerResult.timestamp;
    setAnswerResult({
      isCorrect: playerAnswerResult.isCorrect,
      pointsAwarded: playerAnswerResult.pointsAwarded,
    });

    const closeTimer = window.setTimeout(() => setAnswerResult(null), 1000);
    return () => window.clearTimeout(closeTimer);
  }, [role, playerAnswerResult?.timestamp, playerAnswerResult?.isCorrect, playerAnswerResult?.pointsAwarded]);

  // Initialize unique playerId if not present
  useEffect(() => {
    let savedPId = localStorage.getItem('olympia_player_id');
    if (!savedPId) {
      savedPId = 'p_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('olympia_player_id', savedPId);
    }
    setPlayerId(savedPId);
  }, []);

  // Connect to WebSocket Server
  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket Connected');
    };

    socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === 'INIT_STATE' || msg.type === 'STATE_UPDATE') {
          setRoom(msg.payload as GameState);
          setIsGenerating(false);
        } else if (msg.type === 'ROOM_CANCELLED') {
          setRoom(null);
          setRole('spectator');
          setAnswerResult(null);
          setIsGenerating(false);
        } else if (msg.type === 'ERROR') {
          setErrorMessage(msg.payload as string);
          setTimeout(() => setErrorMessage(null), 4000);
          setIsGenerating(false);
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      // Auto reconnect after 2 seconds
      setTimeout(connectWebSocket, 2000);
    };

    wsRef.current = socket;
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Send message helper
  const sendMessage = (type: string, payload?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !room) return;
    wsRef.current.send(
      JSON.stringify({
        type,
        roomId: room.roomId,
        role,
        playerId,
        payload,
      })
    );
  };

  // Join or Create Room handler
  const handleJoinRoom = (roomCode: string, userRole: Role, name?: string, avatar?: string) => {
    setRole(userRole);
    const roomId = 'room_' + roomCode;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (userRole === 'admin') {
        wsRef.current.send(
          JSON.stringify({
            type: 'CREATE_ROOM',
            roomId,
            role: 'admin',
            payload: { code: roomCode },
          })
        );
      } else {
        wsRef.current.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            roomId,
            role: 'player',
            playerId,
            payload: { name, avatar },
          })
        );
      }
    }
  };

  const handleGenerateQuestions = (topic?: string) => {
    setIsGenerating(true);
    sendMessage('GENERATE_QUESTIONS', { topicCustom: topic });
  };

  const handleStartGame = () => {
    sendMessage('START_GAME');
  };

  const handleNextRound = (targetRound?: string) => {
    sendMessage('NEXT_ROUND', { targetRound });
  };

  const handlePressBuzzer = () => {
    sendMessage('PRESS_BUZZER');
  };

  const handleSubmitAnswer = (answer: string, actionType: 'confirm' | 'skip' = 'confirm') => {
    sendMessage('SUBMIT_ANSWER', { answer, actionType });
  };

  const handleJudgeAnswer = (
    targetPlayerId: string,
    isCorrect: boolean,
    points: number,
    deduct: boolean = false
  ) => {
    sendMessage('JUDGE_ANSWER', {
      playerId: targetPlayerId,
      isCorrect,
      points,
      deduct,
    });
  };

  const handleOpenClue = (clueNumber: number) => {
    sendMessage('OPEN_OBSTACLE_CLUE', { clueNumber });
  };

  const handleGuessObstacleKeyword = (keyword: string, actionType: 'confirm' | 'skip' = 'confirm') => {
    sendMessage('GUESS_OBSTACLE_KEYWORD', { keyword, actionType });
  };

  const handleToggleStarOfHope = () => {
    sendMessage('TOGGLE_STAR_OF_HOPE');
  };

  const handleUpdateScore = (targetPId: string, newScore: number) => {
    sendMessage('UPDATE_SCORE', { playerId: targetPId, newScore });
  };

  const handleStartTimer = (seconds?: number) => {
    sendMessage('START_TIMER', { seconds });
  };

  const handlePauseTimer = () => {
    sendMessage('PAUSE_TIMER');
  };

  const handleResetGame = () => {
    sendMessage('RESET_GAME');
  };

  const handleCancelRoom = () => {
    sendMessage('CANCEL_ROOM');
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 font-sans selection:bg-white selection:text-black pb-20 relative">
      {/* Persistent Top Right Button (Rules Icon - accessible on all pages) */}
      <TopNavControls
        onOpenRules={() => setShowRulesModal(true)}
      />

      {/* Contestant Game Rules Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {/* Toast Notification Alert */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-800 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl border border-teal-600 animate-bounce text-sm">
          ⚠️ {errorMessage}
        </div>
      )}

      {role === 'player' && answerResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-8 text-center text-black shadow-2xl animate-fadeIn">
            {answerResult.isCorrect ? (
              <CheckCircle2 className="mx-auto mb-4 h-16 w-16 stroke-[1.5]" />
            ) : (
              <XCircle className="mx-auto mb-4 h-16 w-16 stroke-[1.5]" />
            )}
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {answerResult.isCorrect ? 'Chính xác!' : 'Chưa chính xác'}
            </h2>
            <p className="mt-2 text-sm font-medium text-neutral-500">
              {answerResult.isCorrect
                ? `Bạn được cộng ${answerResult.pointsAwarded} điểm.`
                : 'Bạn không được cộng điểm.'}
            </p>
          </div>
        </div>
      )}

      {/* Main View Flow */}
      {!room || room.status === 'waiting' ? (
        <Lobby
          room={room || undefined}
          role={role}
          onJoinRoom={handleJoinRoom}
          onGenerateQuestions={handleGenerateQuestions}
          onStartGame={handleStartGame}
          isGenerating={isGenerating}
        />
      ) : (
        <>
          <Header
            room={room}
            role={role}
            playerId={playerId}
            isConnected={isConnected}
            onOpenRules={() => setShowRulesModal(true)}
          />

          <main className="px-4 py-6">
            {room.currentRound === 'warmup' && (
              <RoundWarmUp
                room={room}
                role={role}
                playerId={playerId}
                onPressBuzzer={handlePressBuzzer}
                onSubmitAnswer={handleSubmitAnswer}
                onJudgeAnswer={(targetPId, isCorrect, pts) => handleJudgeAnswer(targetPId, isCorrect, pts)}
                onNextQuestion={() => sendMessage('JUDGE_ANSWER', { nextQuestion: true })}
              />
            )}

            {room.currentRound === 'obstacle' && (
              <RoundObstacle
                room={room}
                role={role}
                playerId={playerId}
                onOpenClue={handleOpenClue}
                onPressBuzzer={handlePressBuzzer}
                onGuessKeyword={handleGuessObstacleKeyword}
                onJudgeClue={(targetPId, isCorrect) => handleGuessObstacleKeyword(room.questions?.obstacle.keyword || '')}
              />
            )}

            {room.currentRound === 'acceleration' && (
              <RoundAcceleration
                room={room}
                role={role}
                playerId={playerId}
                onSubmitAnswer={handleSubmitAnswer}
                onJudgeAnswer={(targetPId, isCorrect, pts) => handleJudgeAnswer(targetPId, isCorrect, pts)}
                onNextQuestion={() => sendMessage('JUDGE_ANSWER', { nextQuestion: true })}
              />
            )}

            {room.currentRound === 'finish' && (
              <RoundFinish
                room={room}
                role={role}
                playerId={playerId}
                onToggleStarOfHope={handleToggleStarOfHope}
                onPressBuzzer={handlePressBuzzer}
                onSubmitAnswer={handleSubmitAnswer}
                onJudgeAnswer={(targetPId, isCorrect, pts, deduct) => handleJudgeAnswer(targetPId, isCorrect, pts, deduct)}
                onNextQuestion={() => sendMessage('JUDGE_ANSWER', { nextQuestion: true })}
              />
            )}
          </main>

          {/* Victory Modal on Summary / Game End */}
          {(room.status === 'ended' || room.currentRound === 'summary') && (
            <VictoryModal room={room} role={role} onResetGame={handleResetGame} />
          )}

          {/* MC Admin Quick Toolbar */}
          {role === 'admin' && (
            <AdminControlDrawer
              room={room}
              onNextRound={handleNextRound}
              onStartTimer={handleStartTimer}
              onPauseTimer={handlePauseTimer}
              onUpdateScore={handleUpdateScore}
              onResetGame={handleResetGame}
              onCancelRoom={handleCancelRoom}
            />
          )}
        </>
      )}
    </div>
  );
}
