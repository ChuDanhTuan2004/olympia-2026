import React, { useEffect, useState, useRef } from 'react';
import { AccountSummary, AuthUser, GameState, Role, WSMessage } from './types';
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
import { LoginScreen } from './components/LoginScreen';
import { AccountManagerModal } from './components/AccountManagerModal';

const SESSION_STORAGE_KEY = 'olympia_active_session';
const AUTH_TOKEN_STORAGE_KEY = 'olympia_auth_token';

interface StoredSession {
  roomId: string;
  role: 'admin' | 'player';
}

export default function App() {
  const [room, setRoom] = useState<GameState | null>(null);
  const [role, setRole] = useState<Role>('spectator');
  const [playerId, setPlayerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; pointsAwarded: number } | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  // Rules Modal State
  const [showRulesModal, setShowRulesModal] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const authTokenRef = useRef<string | null>(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  const authUserRef = useRef<AuthUser | null>(null);
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

      const savedAuthToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      authTokenRef.current = savedAuthToken;
      if (savedAuthToken) {
        socket.send(JSON.stringify({ type: 'AUTH_RESTORE', authToken: savedAuthToken }));
      } else {
        setAuthChecking(false);
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === 'AUTH_SUCCESS') {
          const { token, user, playerId: authenticatedPlayerId } = msg.payload as {
            token: string;
            user: AuthUser;
            playerId?: string;
          };
          authTokenRef.current = token;
          authUserRef.current = user;
          localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
          setAuthUser(user);
          setRole(user.role);
          setAuthChecking(false);
          setAuthSubmitting(false);
          setAuthError(null);

          if (authenticatedPlayerId) {
            localStorage.setItem('olympia_player_id', authenticatedPlayerId);
            setPlayerId(authenticatedPlayerId);
          }

          const storedSessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
          if (storedSessionRaw) {
            try {
              const storedSession = JSON.parse(storedSessionRaw) as StoredSession;
              if (storedSession.roomId && storedSession.role === user.role) {
                socket.send(JSON.stringify({
                  type: 'REJOIN_ROOM',
                  roomId: storedSession.roomId,
                  role: storedSession.role,
                  playerId: authenticatedPlayerId || localStorage.getItem('olympia_player_id') || undefined,
                  authToken: token,
                }));
              } else {
                localStorage.removeItem(SESSION_STORAGE_KEY);
              }
            } catch {
              localStorage.removeItem(SESSION_STORAGE_KEY);
            }
          }
        } else if (msg.type === 'AUTH_ERROR') {
          const message = String(msg.payload || 'Không thể xác thực.');
          setAuthError(message);
          setAccountMessage(message);
          setAuthChecking(false);
          setAuthSubmitting(false);

          if (message.includes('Phiên đăng nhập') || message.includes('cần đăng nhập')) {
            authTokenRef.current = null;
            authUserRef.current = null;
            localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            setAuthUser(null);
            setRoom(null);
          }
        } else if (msg.type === 'ACCOUNT_LIST') {
          setAccounts(msg.payload as AccountSummary[]);
        } else if (msg.type === 'ACCOUNT_CREATED') {
          setAccountMessage(`Đã tạo tài khoản ${msg.payload?.username}.`);
        } else if (msg.type === 'INIT_STATE' || msg.type === 'STATE_UPDATE') {
          const nextRoom = msg.payload as GameState;
          if (msg.type === 'INIT_STATE') {
            const savedPlayerId = localStorage.getItem('olympia_player_id');
            shownAnswerResultTimestamp.current = nextRoom.players.find(
              (player) => player.id === savedPlayerId
            )?.lastAnswerResult?.timestamp;
          }
          setRoom(nextRoom);
          setIsGenerating(false);
        } else if (msg.type === 'ROOM_CANCELLED') {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setRoom(null);
          setRole(authUserRef.current?.role || 'spectator');
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
        authToken: authTokenRef.current || undefined,
        payload,
      })
    );
  };

  const sendAuthenticatedMessage = (type: string, payload?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !authTokenRef.current) return;
    wsRef.current.send(JSON.stringify({ type, authToken: authTokenRef.current, payload }));
  };

  const handleLogin = (username: string, password: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setAuthError('Chưa kết nối được với máy chủ. Vui lòng thử lại.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    wsRef.current.send(JSON.stringify({ type: 'AUTH_LOGIN', payload: { username, password } }));
  };

  const handleLogout = () => {
    sendAuthenticatedMessage('AUTH_LOGOUT');
    authTokenRef.current = null;
    authUserRef.current = null;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setAuthUser(null);
    setRoom(null);
    setRole('spectator');
    setAccounts([]);
    setShowAccountManager(false);
    setAuthError(null);
  };

  const handleOpenAccountManager = () => {
    setAccountMessage(null);
    setShowAccountManager(true);
    sendAuthenticatedMessage('LIST_ACCOUNTS');
  };

  const handleCreateAccount = (username: string, password: string) => {
    setAccountMessage(null);
    sendAuthenticatedMessage('CREATE_ACCOUNT', { username, password });
  };

  const handleDeleteAccount = (username: string) => {
    setAccountMessage(null);
    sendAuthenticatedMessage('DELETE_ACCOUNT', { username });
  };

  // Join or Create Room handler
  const handleJoinRoom = (roomCode: string, userRole: Role, name?: string, avatar?: string) => {
    setRole(userRole);
    const roomId = 'room_' + roomCode;
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ roomId, role: userRole === 'admin' ? 'admin' : 'player' } satisfies StoredSession)
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (userRole === 'admin') {
        wsRef.current.send(
          JSON.stringify({
            type: 'CREATE_ROOM',
            roomId,
            role: 'admin',
            authToken: authTokenRef.current || undefined,
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
            authToken: authTokenRef.current || undefined,
            payload: { name, avatar },
          })
        );
      }
    }
  };

  const handleStartGame = (topic: string) => {
    setIsGenerating(true);
    sendMessage('START_GAME', { topicCustom: topic });
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

  const handleSubmitObstacleClueAnswer = (answer: string) => {
    sendMessage('SUBMIT_OBSTACLE_CLUE_ANSWER', { answer });
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

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <div className="text-sm font-bold animate-pulse">ĐANG KHÔI PHỤC PHIÊN ĐĂNG NHẬP...</div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onLogin={handleLogin} error={authError} isSubmitting={authSubmitting} />;
  }

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

      <AccountManagerModal
        accounts={accounts}
        isOpen={authUser.role === 'admin' && showAccountManager}
        onClose={() => setShowAccountManager(false)}
        onCreate={handleCreateAccount}
        onDelete={handleDeleteAccount}
        message={accountMessage}
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
          onStartGame={handleStartGame}
          isGenerating={isGenerating}
          accountRole={authUser.role}
          accountUsername={authUser.username}
          onOpenAccountManager={handleOpenAccountManager}
          onLogout={handleLogout}
        />
      ) : (
        <>
          <Header
            room={room}
            role={role}
            playerId={playerId}
            isConnected={isConnected}
            onOpenRules={() => setShowRulesModal(true)}
            onCancelRoom={handleCancelRoom}
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
              />
            )}

            {room.currentRound === 'obstacle' && (
              <RoundObstacle
                room={room}
                role={role}
                playerId={playerId}
                onOpenClue={handleOpenClue}
                onPressBuzzer={handlePressBuzzer}
                onSubmitClueAnswer={handleSubmitObstacleClueAnswer}
                onGuessKeyword={handleGuessObstacleKeyword}
              />
            )}

            {room.currentRound === 'acceleration' && (
              <RoundAcceleration
                room={room}
                role={role}
                playerId={playerId}
                onSubmitAnswer={handleSubmitAnswer}
                onJudgeAnswer={(targetPId, isCorrect, pts) => handleJudgeAnswer(targetPId, isCorrect, pts)}
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
              onOpenAccountManager={handleOpenAccountManager}
            />
          )}
        </>
      )}
    </div>
  );
}
