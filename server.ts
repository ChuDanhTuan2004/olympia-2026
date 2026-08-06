import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { GameState, OlympiaQuestions, WSMessage, RoundType } from './src/types.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.use(express.json({ limit: '10mb' }));

// In-Memory Game Rooms
const rooms = new Map<string, GameState>();
// Map WebSocket connections to { roomId, role, playerId }
const clientRoomMap = new Map<WebSocket, { roomId: string; role: string; playerId?: string }>();

// Helper to broadcast state to all clients in a room
function broadcastRoomState(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  const messageStr = JSON.stringify({
    type: 'STATE_UPDATE',
    payload: room,
  });

  for (const [ws, info] of clientRoomMap.entries()) {
    if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
}

// Helper to add room log
function addRoomLog(room: GameState, message: string, type: 'info' | 'success' | 'warning' | 'buzzer' = 'info') {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  room.logs.unshift({
    id: Math.random().toString(36).substr(2, 9),
    time: timeStr,
    message,
    type,
  });

  // Keep max 50 logs
  if (room.logs.length > 50) {
    room.logs.pop();
  }
}

// Default fallback questions in case Gemini key is missing or fails
function getDefaultQuestions(): OlympiaQuestions {
  return {
    warmup: [
      { id: 'w1', question: 'Tác phẩm "Truyện Kiều" của Nguyễn Du được viết bằng chữ gì?', answer: 'Chữ Nôm', points: 10 },
      { id: 'w2', question: 'Hành tinh nào trong Hệ Mặt Trời được gọi là Hỏa Tinh?', answer: 'Sao Hỏa (Mars)', points: 10 },
      { id: 'w3', question: 'Quốc gia nào có diện tích lớn nhất thế giới?', answer: 'Nga', points: 10 },
      { id: 'w4', question: 'Số nguyên tố nhỏ nhất là số mấy?', answer: 'Số 2', points: 10 },
      { id: 'w5', question: 'Nhà thơ nào được mệnh danh là "Thi sĩ của đồng quê" Việt Nam?', answer: 'Nguyễn Bính', points: 10 },
      { id: 'w6', question: 'Bác Hồ đọc Tuyên ngôn Độc lập vào ngày tháng năm nào?', answer: '02/09/1945', points: 10 },
      { id: 'w7', question: 'Kim loại nào dẫn điện tốt nhất ở điều kiện thường?', answer: 'Bạc (Ag)', points: 10 },
      { id: 'w8', question: 'Đỉnh núi nào cao nhất Việt Nam và Đông Dương?', answer: 'Fansipan (Phan-xi-păng)', points: 10 },
      { id: 'w9', question: 'Bộ phận nào trong cơ thể người sản xuất ra mật?', answer: 'Gan', points: 10 },
      { id: 'w10', question: 'Khu vực Đông Nam Á hiện nay có bao nhiêu quốc gia?', answer: '11 quốc gia', points: 10 },
      { id: 'w11', question: 'Thành phố nào là thủ đô của Úc (Australia)?', answer: 'Canberra', points: 10 },
      { id: 'w12', question: 'Trong hóa học, pH = 7 biểu thị môi trường gì?', answer: 'Môi trường trung tính', points: 10 },
    ],
    obstacle: {
      keyword: 'VƯỜN QUỐC GIA',
      keywordLength: 12,
      hintDescription: 'Địa danh bảo tồn thiên nhiên và đa dạng sinh học.',
      clues: [
        { number: 1, question: 'Vườn quốc gia Cúc Phương nằm trên địa bàn 3 tỉnh Ninh Bình, Hòa Bình và tỉnh nào?', answer: 'THANH HÓA', letterCount: 8, isOpened: false },
        { number: 2, question: 'Nhóm sinh vật có khả năng tự tổng hợp chất hữu cơ nhờ ánh sáng mặt trời gọi là gì?', answer: 'THỰC VẬT', letterCount: 7, isOpened: false },
        { number: 3, question: 'Tên gọi chung cho các loài động vật, thực vật quý hiếm cần bảo vệ nghiêm ngặt?', answer: 'BẢO TỒN', letterCount: 6, isOpened: false },
        { number: 4, question: 'Con sông dài nhất chạy qua lãnh thổ Việt Nam?', answer: 'SÔNG HỒNG', letterCount: 8, isOpened: false },
      ],
      isKeywordRevealed: false,
    },
    acceleration: [
      { id: 'a1', number: 1, question: 'Sắp xếp các hành tinh theo khoảng cách tăng dần từ Mặt Trời: Sao Hỏa, Sao Kim, Sao Thủy, Trái Đất.', answer: 'Sao Thủy -> Sao Kim -> Trái Đất -> Sao Hỏa', type: 'reorder' },
      { id: 'a2', number: 2, question: 'Hình tiếp theo trong dãy quy luật số: 2, 6, 12, 20, 30, ... là số nào?', answer: '42 (mỗi bước tăng +4, +6, +8, +10, +12)', type: 'logic' },
      { id: 'a3', number: 3, question: 'Giải câu đố chữ: "Để nguyên tên một vị vua - Thêm sắc thành loại trái cây ngọt ngào". Là chữ gì?', answer: 'Lê (Vua Lê) -> Lế (Hoặc Táo/Lê)', type: 'text' },
      { id: 'a4', number: 4, question: 'Tỉnh nào có đường bờ biển dài nhất Việt Nam?', answer: 'Khánh Hòa (khoảng 385 km)', type: 'text' },
    ],
    finish: {
      player1Package: [
        { id: 'f1_1', pointValue: 20, question: 'Hợp chất nào chiếm khoảng 71% bề mặt Trái Đất?', answer: 'Nước (H2O)', explanation: 'Nước che phủ phần lớn hành tinh chúng ta.' },
        { id: 'f1_2', pointValue: 20, question: 'Ai là tác giả của tác phẩm "Nam quốc sơn hà"?', answer: 'Khuyết danh (Thường gắn liền với Lý Thường Kiệt)', explanation: 'Được coi là bản Tuyên ngôn độc lập đầu tiên.' },
        { id: 'f1_3', pointValue: 30, question: 'Nhiệt độ tuyệt đối 0 Kelvin tương ứng với bao nhiêu độ C?', answer: '-273.15 độ C', explanation: '0 K = -273.15 °C.' },
      ],
      player2Package: [
        { id: 'f2_1', pointValue: 20, question: 'Đại dương nào có diện tích lớn nhất hành tinh?', answer: 'Thái Bình Dương', explanation: 'Rộng hơn 165 triệu km².' },
        { id: 'f2_2', pointValue: 20, question: 'Phản ứng hạt nhân sinh ra năng lượng trên Mặt Trời thuộc loại phản ứng gì?', answer: 'Phản ứng nhiệt hạch (Tổng hợp hạt nhân)', explanation: 'Các hạt nhân Hydro kết hợp thành Heli.' },
        { id: 'f2_3', pointValue: 30, question: 'Bài hát chính thức của Đại hội Thể thao Đông Nam Á SEA Games 31 năm 2022 tại Việt Nam có tên là gì?', answer: 'Hãy tỏa sáng (Let us shine)', explanation: 'Sáng tác bởi nhạc sĩ Huy Tuấn.' },
      ],
      player3Package: [
        { id: 'f3_1', pointValue: 20, question: 'Thành phố nào được mệnh danh là "Thành phố Ngàn hoa" ở Việt Nam?', answer: 'Đà Lạt', explanation: 'Đà Lạt thuộc tỉnh Lâm Đồng.' },
        { id: 'f3_2', pointValue: 20, question: 'Nguyên tố hóa học nào có ký hiệu là Au?', answer: 'Vàng', explanation: 'Aurum trong tiếng Latin.' },
        { id: 'f3_3', pointValue: 30, question: 'Phong trào Cần Vương do ai xướng xuất vào năm 1885?', answer: 'Vua Hàm Nghi và Tôn Thất Thuyết', explanation: 'Hịch Cần Vương ban ra tại căn cứ Tân Sở.' },
      ],
      player4Package: [
        { id: 'f4_1', pointValue: 20, question: 'Dãy núi nào được coi là ranh giới tự nhiên giữa châu Âu và châu Á?', answer: 'Dãy Ural (U-ran)', explanation: 'Chạy dài từ Bắc xuống Nam ở Nga.' },
        { id: 'f4_2', pointValue: 20, question: 'Tế bào máu nào có nhiệm vụ vận chuyển oxy đi khắp cơ thể?', answer: 'Hồng cầu', explanation: 'Hồng cầu chứa hemoglobin gắn oxy.' },
        { id: 'f4_3', pointValue: 30, question: 'Nhà toán học nào nổi tiếng với mệnh đề "Không có ba số nguyên dương a, b, c thỏa mãn a^n + b^n = c^n với n > 2"?', answer: 'Pierre de Fermat (Định lý lớn Fermat)', explanation: 'Được chứng minh bởi Andrew Wiles năm 1994.' },
      ],
    },
  };
}

// Function to generate questions using Gemini API
async function generateGeminiQuestions(topicCustom?: string): Promise<OlympiaQuestions> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY missing, using high-quality default Olympia questions dataset.');
    return getDefaultQuestions();
  }

  const cleanTopic = topicCustom ? topicCustom.trim() : '';

  const systemPrompt = `Bạn là biên tập viên chuyên nghiệp của chương trình "Đường lên đỉnh Olympia" Đài Truyền hình Việt Nam (VTV). 
Nhiệm vụ của bạn là soạn bộ câu hỏi chính xác, chuẩn xác kiến thức, hấp dẫn và công bằng cho 1 trận thi đấu giữa 4 thí sinh.

${cleanTopic !== '' 
  ? `CRITICAL INSTRUCTION - YÊU CẦU TỐI CAO TỪ MC QUẢN TRÒ: Bạn BẮT BUỘC phải soạn toàn bộ câu hỏi DỰA TRÊN CHỦ ĐỀ CHỦ ĐẠO: "${cleanTopic}".
Tất cả các phần thi (12 câu Khởi động, từ khóa + 4 hàng ngang Chướng ngại vật, 4 câu Tăng tốc, và 4 gói Về đích) BẮT BUỘC đều phải xoay quanh hoặc liên quan trực tiếp đến chủ đề "${cleanTopic}".`
  : 'Phủ rộng đa dạng các lĩnh vực: Toán, Lý, Hóa, Sinh, Sử, Địa, Văn học, Tiếng Anh, Thể thao, Nghệ thuật, Hiểu biết chung.'}

Cấu trúc gồm đủ 4 phần thi:
1. warmup: 12 câu hỏi ngắn, câu trả lời rõ ràng, ngắn gọn (10 điểm/câu).
2. obstacle: 
   - keyword: Từ khóa chướng ngại vật (8-16 ký tự viết hoa không dấu, ví dụ: "CON CONG BẰNG", "MẠNG INTERNET", "LỊCH SỬ VIỆT NAM").
   - keywordLength: Số ký tự.
   - hintDescription: Gợi ý chung.
   - clues: 4 hàng ngang là 4 câu hỏi liên quan, đáp án ngắn gọn có độ dài letterCount.
3. acceleration: 4 câu hỏi tăng tốc tư duy, logic, sắp xếp, tính toán hoặc câu đố.
4. finish: 
   - player1Package: 3 câu hỏi (2 câu 20 điểm, 1 câu 30 điểm).
   - player2Package: 3 câu hỏi (2 câu 20 điểm, 1 câu 30 điểm).
   - player3Package: 3 câu hỏi (2 câu 20 điểm, 1 câu 30 điểm).
   - player4Package: 3 câu hỏi (2 câu 20 điểm, 1 câu 30 điểm).

Trả về kết quả JSON theo đúng định dạng. Đảm bảo đáp án Tiếng Việt chính xác 100%.`;

  const userPrompt = cleanTopic !== '' 
    ? `Hãy tạo trọn bộ câu hỏi Đường lên đỉnh Olympia với CHỦ ĐỀ BẮT BUỘC LÀ: "${cleanTopic}". Tất cả các câu hỏi trong 4 phần thi đều phải bám sát chủ đề "${cleanTopic}".`
    : 'Hãy tạo trọn bộ câu hỏi Đường lên đỉnh Olympia hoàn chỉnh phủ rộng đa dạng các lĩnh vực.';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            warmup: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  points: { type: Type.NUMBER },
                },
                required: ['id', 'question', 'answer', 'points'],
              },
            },
            obstacle: {
              type: Type.OBJECT,
              properties: {
                keyword: { type: Type.STRING },
                keywordLength: { type: Type.NUMBER },
                hintDescription: { type: Type.STRING },
                clues: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      number: { type: Type.NUMBER },
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                      letterCount: { type: Type.NUMBER },
                      isOpened: { type: Type.BOOLEAN },
                    },
                    required: ['number', 'question', 'answer', 'letterCount'],
                  },
                },
              },
              required: ['keyword', 'keywordLength', 'hintDescription', 'clues'],
            },
            acceleration: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  number: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  type: { type: Type.STRING },
                },
                required: ['id', 'number', 'question', 'answer'],
              },
            },
            finish: {
              type: Type.OBJECT,
              properties: {
                player1Package: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      pointValue: { type: Type.NUMBER },
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'pointValue', 'question', 'answer'],
                  },
                },
                player2Package: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      pointValue: { type: Type.NUMBER },
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'pointValue', 'question', 'answer'],
                  },
                },
                player3Package: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      pointValue: { type: Type.NUMBER },
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'pointValue', 'question', 'answer'],
                  },
                },
                player4Package: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      pointValue: { type: Type.NUMBER },
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'pointValue', 'question', 'answer'],
                  },
                },
              },
              required: ['player1Package', 'player2Package', 'player3Package', 'player4Package'],
            },
          },
          required: ['warmup', 'obstacle', 'acceleration', 'finish'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const data: OlympiaQuestions = JSON.parse(text);
    // Ensure clues have isOpened set to false initially
    if (data.obstacle && data.obstacle.clues) {
      data.obstacle.clues.forEach((c) => (c.isOpened = false));
      data.obstacle.isKeywordRevealed = false;
    }

    return data;
  } catch (error) {
    console.error('Error generating questions with Gemini:', error);
    return getDefaultQuestions();
  }
}

// REST Endpoint to trigger questions generation independently
app.post('/api/generate-questions', async (req, res) => {
  const { topicCustom } = req.body;
  try {
    const questions = await generateGeminiQuestions(topicCustom);
    res.json({ success: true, questions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper for answer normalization and auto-grading
function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese diacritics
    .replace(/đ/g, 'd')
    .replace(/[^\w\s]/gi, '') // remove punctuation
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

function checkAnswerCorrectness(userAns: string, correctAns: string): boolean {
  if (!userAns || !correctAns) return false;
  const normUser = normalizeString(userAns);
  const normCorrect = normalizeString(correctAns);

  if (normUser === '' || normCorrect === '') return false;

  // Exact match normalized
  if (normUser === normCorrect) return true;

  // Containment check for key phrases
  if (normUser.includes(normCorrect) || normCorrect.includes(normUser)) {
    if (normCorrect.length >= 3 && normUser.length >= 3) {
      return true;
    }
  }

  // Word-by-word match
  const correctWords = normCorrect.split(' ').filter((w) => w.length > 1);
  const userWords = normUser.split(' ');
  if (correctWords.length > 0 && correctWords.every((w) => userWords.includes(w))) {
    return true;
  }

  return false;
}

// Helper to initialize a new Room
function createRoom(roomId: string, customCode?: string): GameState {
  const roomCode = customCode || Math.floor(1000 + Math.random() * 9000).toString();
  const newRoom: GameState = {
    roomId,
    roomCode,
    status: 'waiting',
    currentRound: 'warmup',
    currentQuestionIndex: 0,
    players: [],
    timerSeconds: 60,
    timerActive: false,
    questions: getDefaultQuestions(),
    buzzerLocked: false,
    logs: [],
  };

  addRoomLog(newRoom, `Phòng thi mới được tạo với Mã Phòng: ${roomCode}`, 'info');
  rooms.set(roomId, newRoom);
  return newRoom;
}

// Global room timer ticker
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.timerActive && room.timerSeconds > 0) {
      room.timerSeconds -= 1;
      if (room.timerSeconds <= 0) {
        room.timerActive = false;
        addRoomLog(room, `Hết giờ vòng thi ${room.currentRound.toUpperCase()}!`, 'warning');
      }
      broadcastRoomState(roomId);
    }
  }
}, 1000);

// Handle WebSocket connections
wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    try {
      const msg: WSMessage = JSON.parse(data.toString());
      const { type, roomId, role, playerId, payload } = msg;

      if (!roomId) return;

      let room = rooms.get(roomId);

      if (type === 'CREATE_ROOM') {
        room = createRoom(roomId, payload?.code);
        clientRoomMap.set(ws, { roomId, role: 'admin' });
        addRoomLog(room, 'Admin MC đã kết nối quản lý phòng thi.', 'info');
        ws.send(JSON.stringify({ type: 'INIT_STATE', payload: room }));
        return;
      }

      if (!room) {
        // Auto-create room if not found
        room = createRoom(roomId);
      }

      // Update socket connection map
      clientRoomMap.set(ws, { roomId, role: role || 'spectator', playerId });

      switch (type) {
        case 'JOIN_ROOM': {
          if (role === 'player') {
            const playerName = payload?.name || `Thí sinh ${room.players.length + 1}`;
            const existingIndex = room.players.findIndex((p) => p.id === playerId);

            if (existingIndex >= 0) {
              // Reconnect existing player
              room.players[existingIndex].isOnline = true;
              room.players[existingIndex].name = playerName;
              addRoomLog(room, `${playerName} đã kết nối lại phòng thi.`, 'info');
            } else if (room.players.length < 4) {
              // Add new player (Max 4)
              const avatars = ['🦁', '🦅', '🐉', '⚡'];
              const colors = ['#3b82f6', '#ef4444', '#171717', '#f59e0b'];
              const pIdx = room.players.length;

              const newPlayer = {
                id: playerId || `player_${Date.now()}`,
                name: playerName,
                avatar: payload?.avatar || avatars[pIdx % avatars.length],
                color: colors[pIdx % colors.length],
                score: 0,
                isReady: true,
                isOnline: true,
              };
              room.players.push(newPlayer);
              addRoomLog(room, `${playerName} đã vào vị trí thi đấu (Thí sinh ${room.players.length}/4)`, 'success');
            } else {
              ws.send(JSON.stringify({ type: 'ERROR', payload: 'Phòng đã đủ 4 thí sinh thi đấu!' }));
              return;
            }
          }
          break;
        }

        case 'GENERATE_QUESTIONS': {
          if (role !== 'admin') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ MC Chủ phòng mới có quyền tạo câu hỏi!' }));
            return;
          }
          const customTopic = payload?.topicCustom?.trim();
          addRoomLog(
            room,
            `Gemini AI đang soạn bộ câu hỏi Olympia${customTopic ? ` theo chủ đề: "${customTopic}"` : ''}...`,
            'info'
          );
          broadcastRoomState(roomId);

          const questions = await generateGeminiQuestions(customTopic);
          room.questions = questions;

          // Reset round indexes
          room.currentQuestionIndex = 0;
          if (room.questions?.obstacle) {
            room.obstacleState = {
              openedClues: [],
              keywordGuessed: false,
            };
          }

          addRoomLog(
            room,
            `🎉 Bộ câu hỏi ${customTopic ? `chủ đề "${customTopic}" ` : ''}đã sẵn sàng!`,
            'success'
          );
          break;
        }

        case 'START_GAME': {
          if (role !== 'admin') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ MC Chủ phòng mới có quyền bấm Bắt đầu trận đấu!' }));
            return;
          }
          if (room.players.length < 1) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Cần ít nhất 1 thí sinh để bắt đầu!' }));
            return;
          }
          room.status = 'playing';
          room.currentRound = 'warmup';
          room.currentQuestionIndex = 0;
          room.timerSeconds = 60;
          room.timerActive = true;
          addRoomLog(room, '🚀 TRẬN THI ĐẤU CHÍNH THỨC BẮT ĐẦU! VÒNG 1: KHỞI ĐỘNG', 'success');
          break;
        }

        case 'NEXT_ROUND': {
          if (role !== 'admin') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ MC Chủ phòng mới có quyền chuyển vòng thi!' }));
            return;
          }
          const nextRoundMap: Record<RoundType, RoundType> = {
            warmup: 'obstacle',
            obstacle: 'acceleration',
            acceleration: 'finish',
            finish: 'summary',
            summary: 'summary',
          };
          const nextR = payload?.targetRound || nextRoundMap[room.currentRound];
          room.currentRound = nextR;
          room.currentQuestionIndex = 0;
          room.activeBuzzer = undefined;
          room.buzzerLocked = false;

          if (nextR === 'warmup') {
            room.timerSeconds = 60;
          } else if (nextR === 'obstacle') {
            room.timerSeconds = 90;
            room.obstacleState = { openedClues: [], keywordGuessed: false };
          } else if (nextR === 'acceleration') {
            room.timerSeconds = 30;
            room.accelerationState = { currentQuestionIndex: 0, playerSubmissions: [] };
          } else if (nextR === 'finish') {
            room.timerSeconds = 40;
            const activePId = room.players[0]?.id;
            room.finishState = {
              activeTurnPlayerId: activePId,
              questionIndex: 0,
              starOfHopeActive: false,
              buzzerOpen: false,
              turnPhase: 'selecting_package',
            };
          } else if (nextR === 'summary') {
            room.status = 'ended';
            room.timerActive = false;
          }

          addRoomLog(room, `Chuyển sang vòng thi: ${nextR.toUpperCase()}`, 'info');
          break;
        }

        case 'PRESS_BUZZER': {
          if (room.buzzerLocked) return;

          const player = room.players.find((p) => p.id === playerId);
          if (!player) return;

          room.buzzerLocked = true;
          room.activeBuzzer = {
            playerId: player.id,
            playerName: player.name,
            timestamp: Date.now(),
            round: room.currentRound,
          };

          addRoomLog(room, `🔔 ${player.name} đã bấm CHUÔNG giành quyền trả lời!`, 'buzzer');
          break;
        }

        case 'SUBMIT_ANSWER': {
          const player = room.players.find((p) => p.id === playerId);
          if (!player) return;

          const answerText = (payload?.answer || '').trim();
          const actionType: 'confirm' | 'skip' = payload?.actionType || 'confirm';

          if (room.currentRound === 'warmup') {
            if (room.activeBuzzer?.playerId === player.id) {
              const q = room.questions?.warmup[room.currentQuestionIndex];
              const points = q?.points || 10;

              if (actionType === 'skip') {
                addRoomLog(room, `⏭️ ${player.name} chọn BỎ QUA câu hỏi. (Đáp án chuẩn: "${q?.answer || ''}")`, 'info');
              } else {
                const isCorrect = q ? checkAnswerCorrectness(answerText, q.answer) : false;
                if (isCorrect) {
                  player.score += points;
                  addRoomLog(room, `✅ CHÍNH XÁC! ${player.name} trả lời ĐÚNG ("${answerText}")! (+${points}đ)`, 'success');
                } else {
                  addRoomLog(room, `❌ KHÔNG CHÍNH XÁC! ${player.name} trả lời SAI ("${answerText}"). Đáp án chuẩn: "${q?.answer || ''}"`, 'warning');
                }
              }
              room.activeBuzzer = undefined;
              room.buzzerLocked = false;
            }
          } else if (room.currentRound === 'obstacle') {
            if (room.activeBuzzer?.playerId === player.id) {
              const clueNum = room.obstacleState?.currentClueIndex;
              const clue = room.questions?.obstacle.clues.find((c) => c.number === clueNum);
              if (clue) {
                if (actionType === 'skip') {
                  addRoomLog(room, `⏭️ ${player.name} BỎ QUA câu hỏi Hàng ngang số ${clueNum}.`, 'info');
                } else {
                  const isCorrect = checkAnswerCorrectness(answerText, clue.answer);
                  if (isCorrect) {
                    player.score += 10;
                    clue.isOpened = true;
                    if (!room.obstacleState?.openedClues.includes(clueNum!)) {
                      room.obstacleState?.openedClues.push(clueNum!);
                    }
                    addRoomLog(room, `✅ CHÍNH XÁC! ${player.name} trả lời ĐÚNG Hàng ngang số ${clueNum} ("${answerText}")! (+10đ)`, 'success');
                  } else {
                    addRoomLog(room, `❌ SAI RỒI! ${player.name} trả lời SAI Hàng ngang số ${clueNum} ("${answerText}"). Đáp án chuẩn: "${clue.answer}"`, 'warning');
                  }
                }
              }
              room.activeBuzzer = undefined;
              room.buzzerLocked = false;
            }
          } else if (room.currentRound === 'acceleration' && room.accelerationState) {
            const q = room.questions?.acceleration[room.currentQuestionIndex];

            // Avoid duplicate submissions for same player & question
            const existingIdx = room.accelerationState.playerSubmissions.findIndex(
              (s) => s.playerId === player.id
            );

            if (actionType === 'skip') {
              const subObj = {
                playerId: player.id,
                answer: '[Bỏ qua]',
                timestamp: Date.now(),
                isCorrect: false,
                pointsAwarded: 0,
              };
              if (existingIdx >= 0) {
                room.accelerationState.playerSubmissions[existingIdx] = subObj;
              } else {
                room.accelerationState.playerSubmissions.push(subObj);
              }
              addRoomLog(room, `⏭️ ${player.name} chọn BỎ QUA câu Tăng tốc.`, 'info');
            } else {
              const isCorrect = q ? checkAnswerCorrectness(answerText, q.answer) : false;
              let pointsAwarded = 0;
              if (isCorrect) {
                const correctCountBefore = room.accelerationState.playerSubmissions.filter((s) => s.isCorrect).length;
                pointsAwarded = correctCountBefore === 0 ? 40 : correctCountBefore === 1 ? 30 : correctCountBefore === 2 ? 20 : 10;
                player.score += pointsAwarded;
                addRoomLog(room, `⚡ CHÍNH XÁC! ${player.name} nộp Tăng tốc ĐÚNG thứ #${correctCountBefore + 1} ("${answerText}")! (+${pointsAwarded}đ)`, 'success');
              } else {
                addRoomLog(room, `❌ SAI RỒI! ${player.name} nộp Tăng tốc SAI ("${answerText}"). Đáp án chuẩn: "${q?.answer || ''}"`, 'warning');
              }

              const subObj = {
                playerId: player.id,
                answer: answerText,
                timestamp: Date.now(),
                isCorrect,
                pointsAwarded,
              };
              if (existingIdx >= 0) {
                room.accelerationState.playerSubmissions[existingIdx] = subObj;
              } else {
                room.accelerationState.playerSubmissions.push(subObj);
              }
            }
          } else if (room.currentRound === 'finish' && room.finishState) {
            const turnPlayerId = room.finishState.activeTurnPlayerId;
            const qIndex = room.finishState.questionIndex || 0;
            const playerPkgName = `player${room.players.findIndex((p) => p.id === turnPlayerId) + 1}Package`;
            const finishPkgs = room.questions?.finish as any;
            const pkg = finishPkgs?.[playerPkgName] || finishPkgs?.player1Package || [];
            const q = pkg[qIndex];
            const basePoints = q?.pointValue || 20;
            const starActive = room.finishState.starOfHopeActive;

            if (playerId === turnPlayerId) {
              // Main player turn
              room.finishState.mainPlayerAnswer = actionType === 'skip' ? '[Bỏ qua]' : answerText;

              if (actionType === 'skip') {
                const deduct = starActive ? basePoints : 0;
                if (deduct > 0) {
                  player.score = Math.max(0, player.score - deduct);
                }
                addRoomLog(room, `⏭️ ${player.name} chọn BỎ QUA câu Về đích${starActive ? ` (-${deduct}đ do Ngôi sao hy vọng)` : ''}. Các thí sinh khác có thể BẤM CHUÔNG CƯỚP ĐIỂM!`, 'warning');
                room.finishState.turnPhase = 'stealer_buzzer';
              } else {
                const isCorrect = q ? checkAnswerCorrectness(answerText, q.answer) : false;
                if (isCorrect) {
                  const pts = starActive ? basePoints * 2 : basePoints;
                  player.score += pts;
                  addRoomLog(room, `🎉 CHÍNH XÁC! ${player.name} trả lời ĐÚNG câu Về đích ("${answerText}")${starActive ? ' (CÓ NGÔI SAO HY VỌNG!)' : ''}! (+${pts}đ)`, 'success');
                  room.finishState.turnPhase = 'completed';
                } else {
                  const deduct = starActive ? basePoints : 0;
                  if (deduct > 0) {
                    player.score = Math.max(0, player.score - deduct);
                  }
                  addRoomLog(room, `❌ SAI RỒI! ${player.name} trả lời SAI ("${answerText}")${starActive ? ` (-${deduct}đ do Ngôi sao hy vọng)` : ''}. Đáp án chuẩn: "${q?.answer || ''}". Các thí sinh khác có thể BẤM CHUÔNG CƯỚP ĐIỂM!`, 'warning');
                  room.finishState.turnPhase = 'stealer_buzzer';
                }
              }
            } else if (playerId === room.finishState.stealerPlayerId || room.activeBuzzer?.playerId === playerId) {
              // Stealer turn
              room.finishState.stealerPlayerId = playerId;
              room.finishState.stealerAnswer = actionType === 'skip' ? '[Bỏ qua]' : answerText;
              if (room.activeBuzzer) room.activeBuzzer.answer = answerText;

              if (actionType === 'skip') {
                addRoomLog(room, `⏭️ ${player.name} chọn BỎ QUA cướp điểm.`, 'info');
              } else {
                const isCorrect = q ? checkAnswerCorrectness(answerText, q.answer) : false;
                if (isCorrect) {
                  player.score += basePoints;
                  addRoomLog(room, `⚡ CƯỚP ĐIỂM THÀNH CÔNG! ${player.name} trả lời ĐÚNG ("${answerText}")! (+${basePoints}đ)`, 'success');
                } else {
                  const deduct = Math.round(basePoints / 2);
                  player.score = Math.max(0, player.score - deduct);
                  addRoomLog(room, `❌ CƯỚP ĐIỂM THẤT BẠI! ${player.name} trả lời SAI ("${answerText}") (-${deduct}đ). Đáp án chuẩn: "${q?.answer || ''}"`, 'warning');
                }
              }
              room.activeBuzzer = undefined;
              room.buzzerLocked = false;
              room.finishState.turnPhase = 'completed';
            }
          }
          break;
        }

        case 'OPEN_OBSTACLE_CLUE': {
          const clueNum = payload?.clueNumber;
          if (room.questions?.obstacle) {
            const clue = room.questions.obstacle.clues.find((c) => c.number === clueNum);
            if (clue) {
              clue.isOpened = true;
              if (!room.obstacleState?.openedClues.includes(clueNum)) {
                room.obstacleState?.openedClues.push(clueNum);
              }
              if (room.obstacleState) {
                room.obstacleState.currentClueIndex = clueNum;
              }
              addRoomLog(room, `MC mở Hàng ngang số ${clueNum}`, 'info');
            }
          }
          break;
        }

        case 'GUESS_OBSTACLE_KEYWORD': {
          const player = room.players.find((p) => p.id === playerId);
          if (!player || !room.questions?.obstacle) return;

          const actionType: 'confirm' | 'skip' = payload?.actionType || 'confirm';
          const guess = (payload?.keyword || '').trim();

          if (actionType === 'skip') {
            addRoomLog(room, `⏭️ ${player.name} chọn BỎ QUA đoán Từ khóa Chướng ngại vật.`, 'info');
          } else {
            const target = room.questions.obstacle.keyword;
            const isCorrect = checkAnswerCorrectness(guess, target);

            if (isCorrect) {
              const openedCount = room.obstacleState?.openedClues.length || 0;
              const points = openedCount <= 1 ? 60 : openedCount === 2 ? 50 : openedCount === 3 ? 40 : 30;
              player.score += points;

              if (room.obstacleState) {
                room.obstacleState.keywordGuessed = true;
                room.obstacleState.keywordWinnerId = player.id;
                room.obstacleState.keywordPointsAwarded = points;
              }
              room.questions.obstacle.isKeywordRevealed = true;

              addRoomLog(room, `🎉 CHÚC MỪNG! ${player.name} ĐÃ GIẢI ĐƯỢC CHƯỚNG NGẠI VẬT ("${target}") & CỘNG ${points} ĐIỂM!`, 'success');
            } else {
              addRoomLog(room, `❌ ${player.name} đoán từ khóa SAI ("${guess}").`, 'warning');
            }
          }
          room.activeBuzzer = undefined;
          room.buzzerLocked = false;
          break;
        }

        case 'JUDGE_ANSWER': {
          // Admin judges correct/wrong and awards points
          const targetPlayerId = payload?.playerId;
          const isCorrect = payload?.isCorrect;
          const pointsDelta = payload?.points || 10;

          const player = room.players.find((p) => p.id === targetPlayerId);
          if (player) {
            if (isCorrect) {
              player.score += pointsDelta;
              addRoomLog(room, `✅ Đúng! ${player.name} được +${pointsDelta} điểm (Tổng: ${player.score})`, 'success');
            } else {
              if (payload?.deduct) {
                player.score = Math.max(0, player.score - pointsDelta);
                addRoomLog(room, `❌ Sai! ${player.name} bị -${pointsDelta} điểm (Còn: ${player.score})`, 'warning');
              } else {
                addRoomLog(room, `❌ Sai! ${player.name} không được cộng điểm.`, 'warning');
              }
            }
          }

          // Unlock buzzer after judging
          room.activeBuzzer = undefined;
          room.buzzerLocked = false;
          if (room.finishState) {
            room.finishState.mainPlayerAnswer = undefined;
            room.finishState.stealerAnswer = undefined;
            room.finishState.stealerPlayerId = undefined;
          }

          // Advance question index if specified
          if (payload?.nextQuestion) {
            room.currentQuestionIndex += 1;

            if (room.currentRound === 'finish' && room.finishState) {
              room.finishState.questionIndex += 1;
              if (room.finishState.questionIndex >= 3) {
                // Move to next player turn in Về Đích
                const currentTurnIdx = room.players.findIndex((p) => p.id === room.finishState?.activeTurnPlayerId);
                const nextTurnIdx = currentTurnIdx + 1;

                if (nextTurnIdx < room.players.length) {
                  room.finishState.activeTurnPlayerId = room.players[nextTurnIdx].id;
                  room.finishState.questionIndex = 0;
                  room.finishState.starOfHopeActive = false;
                  addRoomLog(room, `Đến lượt thi Về Đích của ${room.players[nextTurnIdx].name}`, 'info');
                } else {
                  // All players finished Về Đích! End match
                  room.currentRound = 'summary';
                  room.status = 'ended';
                  addRoomLog(room, `🎉 TẤT CẢ THÍ SINH ĐÃ HOÀN THÀNH PHẦN THI VỀ ĐÍCH!`, 'success');
                }
              } else {
                room.finishState.starOfHopeActive = false;
              }
            }
          }
          break;
        }

        case 'TOGGLE_STAR_OF_HOPE': {
          if (room.finishState) {
            room.finishState.starOfHopeActive = !room.finishState.starOfHopeActive;
            const statusStr = room.finishState.starOfHopeActive ? 'BẬT' : 'TẮT';
            addRoomLog(room, `🌟 Thí sinh đã ${statusStr} NGÔI SAO HY VỌNG! (x2 Điểm khi đúng, -50% điểm khi sai)`, 'success');
          }
          break;
        }

        case 'UPDATE_SCORE': {
          const targetP = room.players.find((p) => p.id === payload?.playerId);
          if (targetP) {
            targetP.score = payload?.newScore ?? targetP.score;
            addRoomLog(room, `Admin đã cập nhật điểm của ${targetP.name} thành ${targetP.score}`, 'info');
          }
          break;
        }

        case 'START_TIMER': {
          room.timerActive = true;
          if (payload?.seconds) room.timerSeconds = payload.seconds;
          addRoomLog(room, `Bắt đầu tính giờ (${room.timerSeconds}s)`, 'info');
          break;
        }

        case 'PAUSE_TIMER': {
          room.timerActive = false;
          addRoomLog(room, 'Tạm dừng đồng hồ.', 'info');
          break;
        }

        case 'RESET_GAME': {
          if (role !== 'admin') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ MC Chủ phòng mới có quyền đặt lại trận đấu!' }));
            return;
          }
          room.status = 'waiting';
          room.currentRound = 'warmup';
          room.currentQuestionIndex = 0;
          room.players.forEach((p) => (p.score = 0));
          room.activeBuzzer = undefined;
          room.buzzerLocked = false;
          addRoomLog(room, 'MC đã đặt lại trận thi đấu về phòng chờ!', 'info');
          break;
        }
      }

      broadcastRoomState(roomId);
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    const info = clientRoomMap.get(ws);
    if (info) {
      const room = rooms.get(info.roomId);
      if (room && info.playerId) {
        const player = room.players.find((p) => p.id === info.playerId);
        if (player) {
          player.isOnline = false;
          addRoomLog(room, `${player.name} mất kết nối mạng.`, 'warning');
          broadcastRoomState(info.roomId);
        }
      }
      clientRoomMap.delete(ws);
    }
  });
});

async function startServer() {
  // Setup Vite dev server or static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Olympia Quiz Game Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
