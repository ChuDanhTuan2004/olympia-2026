import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { Pool } from 'pg';
import { AccountRole, GameState, OlympiaQuestions, WSMessage, RoundType } from './src/types.js';

// Local development commonly keeps secrets in .env.local, while deployments
// inject them into process.env. Load .env.local first, then fall back to .env.
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = Number(process.env.PORT) || 3000;

interface AccountRecord {
  username: string;
  role: AccountRole;
  passwordHash: string;
  createdAt: number;
}

interface AuthSession {
  username: string;
  role: AccountRole;
}

const accountsFilePath = path.join(process.cwd(), 'data', 'accounts.json');
const accounts = new Map<string, AccountRecord>();
let accountsPool: Pool | null = null;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  try {
    const [salt, hashHex] = storedHash.split(':');
    const storedBuffer = Buffer.from(hashHex, 'hex');
    const suppliedBuffer = scryptSync(password, salt, storedBuffer.length);
    return storedBuffer.length === suppliedBuffer.length && timingSafeEqual(storedBuffer, suppliedBuffer);
  } catch {
    return false;
  }
}

function saveAccountsLocally() {
  fs.mkdirSync(path.dirname(accountsFilePath), { recursive: true });
  const temporaryPath = `${accountsFilePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify([...accounts.values()], null, 2), 'utf8');
  fs.renameSync(temporaryPath, accountsFilePath);
}

function loadAccountsLocally() {
  try {
    if (fs.existsSync(accountsFilePath)) {
      const storedAccounts = JSON.parse(fs.readFileSync(accountsFilePath, 'utf8')) as AccountRecord[];
      for (const account of storedAccounts) {
        accounts.set(account.username.toLowerCase(), account);
      }
    }
  } catch (error) {
    console.error('Không thể đọc dữ liệu tài khoản:', error);
  }
}

async function persistAccount(account: AccountRecord) {
  if (accountsPool) {
    try {
      await accountsPool.query(
        `INSERT INTO olympia_accounts (username, role, password_hash, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE SET
           role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash,
           created_at = EXCLUDED.created_at`,
        [account.username, account.role, account.passwordHash, account.createdAt]
      );
    } catch (err) {
      console.warn('Lỗi ghi tài khoản vào PostgreSQL:', err);
    }
  }

  saveAccountsLocally();
}

async function deletePersistedAccount(username: string) {
  if (accountsPool) {
    try {
      await accountsPool.query('DELETE FROM olympia_accounts WHERE username = $1', [username]);
    } catch (err) {
      console.warn('Lỗi xóa tài khoản khỏi PostgreSQL:', err);
    }
  }

  saveAccountsLocally();
}

function fixDatabaseUrl(urlStr: string): string {
  if (!urlStr) return urlStr;
  const lastAtIdx = urlStr.lastIndexOf('@');
  if (lastAtIdx === -1) return urlStr;
  const prefix = urlStr.slice(0, lastAtIdx);
  const rest = urlStr.slice(lastAtIdx + 1);
  const schemeMatch = prefix.match(/^(postgres(?:ql)?:\/\/)(.*)$/);
  if (!schemeMatch) return urlStr;
  const scheme = schemeMatch[1];
  const userpass = schemeMatch[2];
  const colonIdx = userpass.indexOf(':');
  if (colonIdx === -1) return urlStr;
  const rawUser = userpass.slice(0, colonIdx);
  const rawPass = userpass.slice(colonIdx + 1);
  const encUser = encodeURIComponent(decodeURIComponent(rawUser));
  const encPass = encodeURIComponent(decodeURIComponent(rawPass));
  return `${scheme}${encUser}:${encPass}@${rest}`;
}

async function initializeAccountStore() {
  // Always load local JSON accounts first
  loadAccountsLocally();

  const rawDatabaseUrl = process.env.DATABASE_URL?.trim();

  if (rawDatabaseUrl) {
    const databaseUrl = fixDatabaseUrl(rawDatabaseUrl);
    try {
      const usesLocalDatabase = /localhost|127\.0\.0\.1/.test(databaseUrl);
      accountsPool = new Pool({
        connectionString: databaseUrl,
        ssl: usesLocalDatabase ? undefined : { rejectUnauthorized: false },
      });
      await accountsPool.query(`
        CREATE TABLE IF NOT EXISTS olympia_accounts (
          username TEXT PRIMARY KEY,
          role TEXT NOT NULL CHECK (role IN ('admin', 'player')),
          password_hash TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);

      // Sync any local accounts into PostgreSQL
      for (const account of accounts.values()) {
        try {
          await accountsPool.query(
            `INSERT INTO olympia_accounts (username, role, password_hash, created_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (username) DO NOTHING`,
            [account.username, account.role, account.passwordHash, account.createdAt]
          );
        } catch (e) {
          // ignore sync warning
        }
      }

      // Fetch all accounts from PostgreSQL
      const result = await accountsPool.query<{
        username: string;
        role: AccountRole;
        password_hash: string;
        created_at: string;
      }>('SELECT username, role, password_hash, created_at FROM olympia_accounts');

      for (const row of result.rows) {
        accounts.set(row.username.toLowerCase(), {
          username: row.username,
          role: row.role,
          passwordHash: row.password_hash,
          createdAt: Number(row.created_at),
        });
      }
      console.log(`Đã tải ${accounts.size} tài khoản từ PostgreSQL.`);
      saveAccountsLocally();
    } catch (err) {
      console.warn('Không thể kết nối PostgreSQL, dùng lưu trữ local:', err);
      if (accountsPool) {
        accountsPool.end().catch(() => {});
      }
      accountsPool = null;
    }
  } else {
    console.warn('DATABASE_URL chưa được cấu hình; tài khoản đang dùng file local.');
  }

  const adminAccount = accounts.get('tuancd');
  if (!adminAccount || adminAccount.role !== 'admin' || !verifyPassword('6868', adminAccount.passwordHash)) {
    const defaultAdmin: AccountRecord = {
      username: 'tuancd',
      role: 'admin',
      passwordHash: hashPassword('6868'),
      createdAt: adminAccount?.createdAt || Date.now(),
    };
    accounts.set('tuancd', defaultAdmin);
    await persistAccount(defaultAdmin);
  }
}

const authSessions = new Map<string, AuthSession>();

// Initialize Gemini Client helper
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.use(express.json({ limit: '10mb' }));

// In-Memory Game Rooms
const rooms = new Map<string, GameState>();
const accelerationAdvanceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const warmupAdvanceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const finishAdvanceTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

function recordAnswerResult(
  player: GameState['players'][number],
  isCorrect: boolean,
  pointsAwarded: number
) {
  player.lastAnswerResult = {
    isCorrect,
    pointsAwarded,
    timestamp: Date.now(),
  };
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
  const cleanTopic = topicCustom ? topicCustom.trim() : '';
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    console.warn('GEMINI_API_KEY missing.');
    if (cleanTopic) {
      throw new Error('Chưa thiết lập GEMINI_API_KEY trong hệ thống. Vui lòng thêm GEMINI_API_KEY vào cấu hình để tạo câu hỏi AI theo chủ đề.');
    }
    return getDefaultQuestions();
  }

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
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash',
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
      data.obstacle.clues.forEach((c) => {
        c.isOpened = false;
        c.isAnswered = false;
      });
      data.obstacle.isKeywordRevealed = false;
    }

    return data;
  } catch (error: any) {
    console.error('Error generating questions with Gemini:', error);
    if (cleanTopic) {
      throw new Error(`Lỗi gọi Gemini AI (${error?.message || 'Không thể tạo bộ câu hỏi'}). Vui lòng kiểm tra lại GEMINI_API_KEY.`);
    }
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

function resetWarmupQuestion(room: GameState) {
  room.warmupState = {
    currentQuestionIndex: room.currentQuestionIndex,
    playerAnswers: {},
    attemptedPlayerIds: [],
    phase: 'awaiting_buzzer',
  };
  room.activeBuzzer = undefined;
  room.buzzerLocked = false;
  room.timerSeconds = 30;
  room.timerActive = true;
}

function allWarmupPlayersAttempted(room: GameState) {
  const participatingPlayers = room.players.filter((player) => player.isOnline !== false);
  return (
    participatingPlayers.length > 0 &&
    participatingPlayers.every((player) => room.warmupState?.attemptedPlayerIds.includes(player.id))
  );
}

function createObstacleState(room: GameState): NonNullable<GameState['obstacleState']> {
  const rankedPlayers = room.players
    .map((player) => ({ player, tieBreaker: Math.random() }))
    .sort((a, b) => a.player.score - b.player.score || a.tieBreaker - b.tieBreaker)
    .map(({ player }) => player.id);
  const clueCount = room.questions?.obstacle.clues.length || 0;
  const selectionOrder = Array.from(
    { length: clueCount },
    (_, index) => rankedPlayers[index % Math.max(rankedPlayers.length, 1)]
  ).filter(Boolean);

  return {
    openedClues: [],
    keywordGuessed: false,
    selectionOrder,
    selectionTurnIndex: 0,
    phase: 'selecting_clue',
    clueSubmissions: [],
    eliminatedPlayerIds: [],
  };
}

function initializeObstacleRound(room: GameState) {
  room.currentRound = 'obstacle';
  room.currentQuestionIndex = 0;
  room.obstacleState = createObstacleState(room);
  if (room.questions?.obstacle) {
    room.questions.obstacle.isKeywordRevealed = false;
    room.questions.obstacle.clues.forEach((clue) => {
      clue.isOpened = false;
      clue.isAnswered = false;
    });
  }
  room.activeBuzzer = undefined;
  room.buzzerLocked = false;
  room.timerSeconds = 0;
  room.timerActive = false;
}

function advanceObstacleSelection(room: GameState) {
  const state = room.obstacleState;
  if (!state) return;

  const completedClue = room.questions?.obstacle.clues.find(
    (clue) => clue.number === state.currentClueIndex
  );
  if (completedClue) {
    completedClue.isAnswered = state.clueSubmissions.some(
      (submission) => submission.isCorrect
    );
  }
  state.currentClueIndex = undefined;
  state.clueSubmissions = [];
  state.selectionTurnIndex += 1;
  while (
    state.selectionTurnIndex < state.selectionOrder.length &&
    state.eliminatedPlayerIds.includes(state.selectionOrder[state.selectionTurnIndex])
  ) {
    state.selectionTurnIndex += 1;
  }

  if (state.selectionTurnIndex < state.selectionOrder.length) {
    state.phase = 'selecting_clue';
    room.timerSeconds = 0;
    room.timerActive = false;
  } else {
    state.phase = 'final_keyword_window';
    room.timerSeconds = 20;
    room.timerActive = true;
  }
}

function obstacleEligiblePlayers(room: GameState) {
  return room.players.filter(
    (player) =>
      player.isOnline !== false &&
      !room.obstacleState?.eliminatedPlayerIds.includes(player.id)
  );
}

function resumeObstacleAfterKeywordAttempt(room: GameState) {
  const state = room.obstacleState;
  if (!state) return;
  state.phase = state.resumePhase || 'selecting_clue';
  const resumeSeconds = state.resumeTimerSeconds;
  state.resumePhase = undefined;
  state.resumeTimerSeconds = undefined;
  if (state.phase === 'answering_clue' && state.currentClueIndex) {
    room.timerSeconds = resumeSeconds || 30;
    room.timerActive = true;
  } else if (state.phase === 'final_keyword_window') {
    room.timerSeconds = resumeSeconds || 20;
    room.timerActive = true;
  } else {
    room.timerSeconds = 0;
    room.timerActive = false;
  }
  room.activeBuzzer = undefined;
  room.buzzerLocked = false;

  const selectorId = state.selectionOrder[state.selectionTurnIndex];
  if (
    state.phase === 'selecting_clue' &&
    selectorId &&
    state.eliminatedPlayerIds.includes(selectorId)
  ) {
    advanceObstacleSelection(room);
  } else if (
    state.phase === 'answering_clue' &&
    obstacleEligiblePlayers(room).every((player) =>
      state.clueSubmissions.some((submission) => submission.playerId === player.id)
    )
  ) {
    advanceObstacleSelection(room);
  }
}

function initializeAccelerationRound(room: GameState) {
  room.currentRound = 'acceleration';
  room.currentQuestionIndex = 0;
  room.accelerationState = {
    currentQuestionIndex: 0,
    playerSubmissions: [],
  };
  room.activeBuzzer = undefined;
  room.buzzerLocked = false;
  room.timerSeconds = 30;
  room.timerActive = true;
}

function revealWarmupAnswer(room: GameState, reason: 'all_failed' | 'no_buzzer') {
  const question = room.questions?.warmup[room.currentQuestionIndex];
  if (!room.warmupState || !question) return;

  room.warmupState.phase = 'revealing';
  room.warmupState.revealedAnswer = question.answer;
  room.warmupState.revealReason = reason;
  room.activeBuzzer = undefined;
  room.buzzerLocked = true;
  room.timerSeconds = 5;
  room.timerActive = true;
  addRoomLog(
    room,
    reason === 'all_failed'
      ? `Tất cả thí sinh đã mất quyền trả lời. Đáp án đúng: ${question.answer}`
      : `Không có thí sinh bấm chuông. Đáp án đúng: ${question.answer}`,
    'info'
  );
}

function advanceWarmupQuestion(roomId: string, room: GameState) {
  const questions = room.questions?.warmup || [];
  if (room.currentQuestionIndex < questions.length - 1) {
    room.currentQuestionIndex += 1;
    resetWarmupQuestion(room);
    addRoomLog(room, `Chuyển sang câu Khởi động ${room.currentQuestionIndex + 1}.`, 'info');
  } else {
    if (room.warmupState) room.warmupState.phase = 'completed';
    initializeObstacleRound(room);
    addRoomLog(room, 'Hoàn thành vòng Khởi động. Tự động chuyển sang Vượt chướng ngại vật.', 'success');
  }
  broadcastRoomState(roomId);
}

function advanceFinishQuestion(roomId: string, room: GameState) {
  if (!room.finishState) return;

  room.currentQuestionIndex += 1;
  room.finishState.questionIndex += 1;
  room.finishState.mainPlayerAnswer = undefined;
  room.finishState.stealerAnswer = undefined;
  room.finishState.stealerPlayerId = undefined;
  room.finishState.starOfHopeActive = false;
  room.activeBuzzer = undefined;
  room.buzzerLocked = false;

  if (room.finishState.questionIndex >= 3) {
    const currentTurnIndex = room.players.findIndex(
      (player) => player.id === room.finishState?.activeTurnPlayerId
    );
    const nextTurnIndex = currentTurnIndex + 1;

    if (nextTurnIndex < room.players.length) {
      room.finishState.activeTurnPlayerId = room.players[nextTurnIndex].id;
      room.finishState.questionIndex = 0;
      room.finishState.turnPhase = 'question_active';
      room.timerSeconds = 40;
      room.timerActive = true;
      addRoomLog(room, `Đến lượt thi Về đích của ${room.players[nextTurnIndex].name}.`, 'info');
    } else {
      room.currentRound = 'summary';
      room.status = 'ended';
      room.timerSeconds = 0;
      room.timerActive = false;
      addRoomLog(room, 'Tất cả thí sinh đã hoàn thành phần thi Về đích!', 'success');
    }
  } else {
    room.finishState.turnPhase = 'question_active';
    room.timerSeconds = 40;
    room.timerActive = true;
  }

  broadcastRoomState(roomId);
}

function scheduleFinishAdvance(roomId: string, room: GameState) {
  if (!room.finishState || finishAdvanceTimers.has(roomId)) return;
  const questionIndex = room.finishState.questionIndex;
  const activePlayerId = room.finishState.activeTurnPlayerId;
  room.timerActive = false;

  const timer = setTimeout(() => {
    finishAdvanceTimers.delete(roomId);
    const activeRoom = rooms.get(roomId);
    if (
      activeRoom?.currentRound === 'finish' &&
      activeRoom.finishState?.questionIndex === questionIndex &&
      activeRoom.finishState.activeTurnPlayerId === activePlayerId
    ) {
      advanceFinishQuestion(roomId, activeRoom);
    }
  }, 1000);
  finishAdvanceTimers.set(roomId, timer);
}

// Global room timer ticker
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.timerActive && room.timerSeconds > 0) {
      room.timerSeconds -= 1;
      if (room.timerSeconds <= 0) {
        if (room.currentRound === 'warmup' && room.warmupState) {
          if (room.warmupState.phase === 'answering') {
            const timedOutPlayer = room.players.find(
              (player) => player.id === room.activeBuzzer?.playerId
            );
            if (timedOutPlayer) {
              if (!room.warmupState.attemptedPlayerIds.includes(timedOutPlayer.id)) {
                room.warmupState.attemptedPlayerIds.push(timedOutPlayer.id);
              }
              recordAnswerResult(timedOutPlayer, false, 0);
              addRoomLog(room, `${timedOutPlayer.name} hết 20 giây trả lời và mất quyền ở câu này.`, 'warning');
            }
            room.activeBuzzer = undefined;
            room.buzzerLocked = false;

            if (allWarmupPlayersAttempted(room)) {
              revealWarmupAnswer(room, 'all_failed');
            } else {
              room.warmupState.phase = 'awaiting_buzzer';
              room.timerSeconds = 30;
              room.timerActive = true;
            }
          } else if (room.warmupState.phase === 'revealing') {
            advanceWarmupQuestion(roomId, room);
            continue;
          } else if (room.warmupState.phase === 'awaiting_buzzer') {
            revealWarmupAnswer(room, 'no_buzzer');
          }

          broadcastRoomState(roomId);
          continue;
        }

        if (room.currentRound === 'obstacle' && room.obstacleState) {
          if (room.obstacleState.phase === 'keyword_answering') {
            const timedOutPlayer = room.players.find(
              (player) => player.id === room.activeBuzzer?.playerId
            );
            if (timedOutPlayer) {
              if (!room.obstacleState.eliminatedPlayerIds.includes(timedOutPlayer.id)) {
                room.obstacleState.eliminatedPlayerIds.push(timedOutPlayer.id);
              }
              recordAnswerResult(timedOutPlayer, false, 0);
              addRoomLog(
                room,
                `${timedOutPlayer.name} hết 30 giây đoán chướng ngại vật và bị loại khỏi phần thi này.`,
                'warning'
              );
            }
            resumeObstacleAfterKeywordAttempt(room);
          } else if (room.obstacleState.phase === 'answering_clue') {
            addRoomLog(room, 'Hết thời gian trả lời hàng ngang. Chuyển quyền chọn cho thí sinh tiếp theo.', 'info');
            advanceObstacleSelection(room);
          } else if (room.obstacleState.phase === 'final_keyword_window') {
            room.questions!.obstacle.isKeywordRevealed = true;
            room.obstacleState.phase = 'revealing_keyword';
            room.activeBuzzer = undefined;
            room.buzzerLocked = true;
            room.timerSeconds = 5;
            room.timerActive = true;
            addRoomLog(
              room,
              `Không ai giải được Chướng ngại vật. Đáp án: "${room.questions!.obstacle.keyword}".`,
              'info'
            );
          } else if (room.obstacleState.phase === 'revealing_keyword') {
            initializeAccelerationRound(room);
            addRoomLog(room, 'Tự động chuyển sang vòng Tăng tốc.', 'success');
          }
          broadcastRoomState(roomId);
          continue;
        }

        if (room.currentRound === 'acceleration' && room.accelerationState) {
          room.timerActive = false;
          const completedQuestionIndex = room.currentQuestionIndex;
          const questions = room.questions?.acceleration || [];
          addRoomLog(room, `Hết giờ câu Tăng tốc ${completedQuestionIndex + 1}.`, 'warning');

          if (
            completedQuestionIndex < questions.length - 1 &&
            !accelerationAdvanceTimers.has(roomId)
          ) {
            const advanceTimer = setTimeout(() => {
              accelerationAdvanceTimers.delete(roomId);
              const activeRoom = rooms.get(roomId);
              if (
                activeRoom?.currentRound === 'acceleration' &&
                activeRoom.currentQuestionIndex === completedQuestionIndex &&
                activeRoom.accelerationState
              ) {
                activeRoom.currentQuestionIndex += 1;
                activeRoom.accelerationState.currentQuestionIndex = activeRoom.currentQuestionIndex;
                activeRoom.accelerationState.playerSubmissions = [];
                activeRoom.timerSeconds = 30;
                activeRoom.timerActive = true;
                broadcastRoomState(roomId);
              }
            }, 1000);
            accelerationAdvanceTimers.set(roomId, advanceTimer);
          }

          broadcastRoomState(roomId);
          continue;
        }

        if (room.currentRound === 'finish' && room.finishState) {
          const timedOutPlayerId = room.activeBuzzer?.playerId || room.finishState.activeTurnPlayerId;
          const timedOutPlayer = room.players.find((player) => player.id === timedOutPlayerId);
          if (timedOutPlayer) recordAnswerResult(timedOutPlayer, false, 0);
          room.finishState.turnPhase = 'completed';
          room.activeBuzzer = undefined;
          room.buzzerLocked = true;
          addRoomLog(room, 'Hết giờ câu Về đích. Hệ thống tự động chuyển câu.', 'warning');
          scheduleFinishAdvance(roomId, room);
          broadcastRoomState(roomId);
          continue;
        }

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
      const {
        type,
        roomId,
        role: requestedRole,
        playerId: requestedPlayerId,
        authToken,
        payload,
      } = msg;

      if (type === 'AUTH_LOGIN') {
        const username = String(payload?.username || '').trim().toLowerCase();
        const password = String(payload?.password || '');
        const account = accounts.get(username);

        if (!account || !verifyPassword(password, account.passwordHash)) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Tên đăng nhập hoặc mật khẩu không đúng.' }));
          return;
        }

        const token = randomUUID();
        authSessions.set(token, { username: account.username, role: account.role });
        ws.send(JSON.stringify({
          type: 'AUTH_SUCCESS',
          payload: {
            token,
            user: { username: account.username, role: account.role },
            playerId: account.role === 'player' ? `user_${account.username}` : undefined,
          },
        }));
        return;
      }

      if (type === 'AUTH_RESTORE') {
        const session = authToken ? authSessions.get(authToken) : undefined;
        if (!session) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Phiên đăng nhập đã hết hạn.' }));
          return;
        }

        ws.send(JSON.stringify({
          type: 'AUTH_SUCCESS',
          payload: {
            token: authToken,
            user: session,
            playerId: session.role === 'player' ? `user_${session.username}` : undefined,
          },
        }));
        return;
      }

      if (type === 'AUTH_LOGOUT') {
        if (authToken) authSessions.delete(authToken);
        const connectionInfo = clientRoomMap.get(ws);
        if (connectionInfo) {
          clientRoomMap.delete(ws);
          const activeRoom = rooms.get(connectionInfo.roomId);
          if (activeRoom && connectionInfo.playerId) {
            const player = activeRoom.players.find((candidate) => candidate.id === connectionInfo.playerId);
            if (player) {
              player.isOnline = false;
              broadcastRoomState(connectionInfo.roomId);
            }
          }
        }
        return;
      }

      const authSession = authToken ? authSessions.get(authToken) : undefined;
      if (!authSession) {
        ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Bạn cần đăng nhập để tiếp tục.' }));
        return;
      }

      if (type === 'LIST_ACCOUNTS') {
        if (authSession.role !== 'admin') {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Chỉ admin được quản lý tài khoản.' }));
          return;
        }
        ws.send(JSON.stringify({
          type: 'ACCOUNT_LIST',
          payload: [...accounts.values()].map(({ username, role, createdAt }) => ({ username, role, createdAt })),
        }));
        return;
      }

      if (type === 'CREATE_ACCOUNT') {
        if (authSession.role !== 'admin') {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Chỉ admin được tạo tài khoản.' }));
          return;
        }

        const username = String(payload?.username || '').trim().toLowerCase();
        const password = String(payload?.password || '');
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Tên đăng nhập cần 3–30 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.' }));
          return;
        }
        if (password.length < 4) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Mật khẩu phải có ít nhất 4 ký tự.' }));
          return;
        }
        if (accounts.has(username)) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Tên đăng nhập đã tồn tại.' }));
          return;
        }

        const newAccount: AccountRecord = {
          username,
          role: 'player',
          passwordHash: hashPassword(password),
          createdAt: Date.now(),
        };
        accounts.set(username, newAccount);
        try {
          await persistAccount(newAccount);
        } catch (error) {
          accounts.delete(username);
          console.error('Không thể lưu tài khoản:', error);
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Không thể lưu tài khoản. Vui lòng thử lại.' }));
          return;
        }
        ws.send(JSON.stringify({ type: 'ACCOUNT_CREATED', payload: { username } }));
        ws.send(JSON.stringify({
          type: 'ACCOUNT_LIST',
          payload: [...accounts.values()].map(({ username, role, createdAt }) => ({ username, role, createdAt })),
        }));
        return;
      }

      if (type === 'DELETE_ACCOUNT') {
        if (authSession.role !== 'admin') {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Chỉ admin được xóa tài khoản.' }));
          return;
        }
        const username = String(payload?.username || '').trim().toLowerCase();
        const account = accounts.get(username);
        if (!account || account.role === 'admin') {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Không thể xóa tài khoản này.' }));
          return;
        }

        try {
          await deletePersistedAccount(username);
        } catch (error) {
          console.error('Không thể xóa tài khoản:', error);
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Không thể xóa tài khoản. Vui lòng thử lại.' }));
          return;
        }
        accounts.delete(username);
        for (const [token, session] of authSessions.entries()) {
          if (session.username === username) authSessions.delete(token);
        }
        ws.send(JSON.stringify({
          type: 'ACCOUNT_LIST',
          payload: [...accounts.values()].map(({ username: name, role, createdAt }) => ({ username: name, role, createdAt })),
        }));
        return;
      }

      const role = authSession.role;
      const playerId = role === 'player' ? `user_${authSession.username}` : requestedPlayerId;

      if (!roomId) return;

      let room = rooms.get(roomId);

      if (type === 'REJOIN_ROOM') {
        if (!room) {
          ws.send(JSON.stringify({ type: 'ROOM_CANCELLED', payload: { reason: 'Phòng không còn tồn tại.' } }));
          return;
        }

        if (role === 'player') {
          const returningPlayer = room.players.find((player) => player.id === playerId);
          if (!returningPlayer) {
            ws.send(JSON.stringify({ type: 'ROOM_CANCELLED', payload: { reason: 'Không tìm thấy phiên thí sinh.' } }));
            return;
          }
          returningPlayer.isOnline = true;
        }

        clientRoomMap.set(ws, { roomId, role: role || 'spectator', playerId });
        ws.send(JSON.stringify({ type: 'INIT_STATE', payload: room }));
        broadcastRoomState(roomId);
        return;
      }

      if (type === 'CREATE_ROOM') {
        if (role !== 'admin') {
          ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ admin được tạo phòng.' }));
          return;
        }
        room = createRoom(roomId, payload?.code);
        clientRoomMap.set(ws, { roomId, role: 'admin' });
        addRoomLog(room, 'Admin MC đã kết nối quản lý phòng thi.', 'info');
        ws.send(JSON.stringify({ type: 'INIT_STATE', payload: room }));
        return;
      }

      if (!room) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: 'Phòng không tồn tại. Vui lòng kiểm tra lại mã phòng.',
        }));
        return;
      }

      // Update socket connection map
      clientRoomMap.set(ws, { roomId, role: role || 'spectator', playerId });

      switch (type) {
        case 'JOIN_ROOM': {
          if (role !== 'player') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ tài khoản người chơi được tham gia thi đấu.' }));
            return;
          }
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
            room.obstacleState = createObstacleState(room);
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
          const customTopic = payload?.topicCustom?.trim();
          if (!customTopic) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Vui lòng nhập chủ đề trước khi bắt đầu trận đấu.' }));
            return;
          }

          addRoomLog(room, `Gemini AI đang soạn bộ câu hỏi theo chủ đề: "${customTopic}"...`, 'info');
          try {
            room.questions = await generateGeminiQuestions(customTopic);
          } catch (error: any) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: error?.message || 'Không thể tạo bộ câu hỏi bằng Gemini AI.',
            }));
            return;
          }

          room.status = 'playing';
          room.currentRound = 'warmup';
          room.currentQuestionIndex = 0;
          resetWarmupQuestion(room);
          addRoomLog(room, '🚀 TRẬN THI ĐẤU CHÍNH THỨC BẮT ĐẦU! VÒNG 1: KHỞI ĐỘNG', 'success');
          break;
        }

        case 'NEXT_ROUND': {
          if (role !== 'admin') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ MC Chủ phòng mới có quyền chuyển vòng thi!' }));
            return;
          }
          const pendingWarmupAdvance = warmupAdvanceTimers.get(roomId);
          if (pendingWarmupAdvance) {
            clearTimeout(pendingWarmupAdvance);
            warmupAdvanceTimers.delete(roomId);
          }
          const pendingFinishAdvance = finishAdvanceTimers.get(roomId);
          if (pendingFinishAdvance) {
            clearTimeout(pendingFinishAdvance);
            finishAdvanceTimers.delete(roomId);
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
            resetWarmupQuestion(room);
          } else if (nextR === 'obstacle') {
            initializeObstacleRound(room);
          } else if (nextR === 'acceleration') {
            initializeAccelerationRound(room);
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

          if (room.currentRound === 'warmup') {
            if (
              !room.warmupState ||
              room.warmupState.phase !== 'awaiting_buzzer' ||
              room.warmupState.attemptedPlayerIds.includes(player.id)
            ) {
              return;
            }
            room.warmupState.phase = 'answering';
            room.timerSeconds = 20;
            room.timerActive = true;
          } else if (room.currentRound === 'obstacle') {
            const state = room.obstacleState;
            if (
              !state ||
              room.questions?.obstacle.isKeywordRevealed ||
              state.phase === 'keyword_answering' ||
              state.eliminatedPlayerIds.includes(player.id)
            ) {
              return;
            }
            state.resumePhase =
              state.phase === 'answering_clue'
                ? 'answering_clue'
                : state.phase === 'final_keyword_window'
                  ? 'final_keyword_window'
                : state.phase === 'completed'
                  ? 'completed'
                  : 'selecting_clue';
            state.resumeTimerSeconds = room.timerSeconds;
            state.phase = 'keyword_answering';
            room.timerSeconds = 30;
            room.timerActive = true;
          }

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
            if (
              room.activeBuzzer?.playerId === player.id &&
              room.warmupState?.phase === 'answering'
            ) {
              const q = room.questions?.warmup[room.currentQuestionIndex];
              const isCorrect =
                actionType !== 'skip' && q
                  ? checkAnswerCorrectness(answerText, q.answer)
                  : false;

              room.warmupState.playerAnswers[player.id] =
                actionType === 'skip' ? '[Bỏ qua]' : answerText;

              if (isCorrect) {
                player.score += 10;
                recordAnswerResult(player, true, 10);
                room.warmupState.phase = 'completed';
                room.timerActive = false;
                addRoomLog(room, `✅ CHÍNH XÁC! ${player.name} trả lời ĐÚNG ("${answerText}")! (+10đ)`, 'success');

                const completedQuestionIndex = room.currentQuestionIndex;
                if (!warmupAdvanceTimers.has(roomId)) {
                  const advanceTimer = setTimeout(() => {
                    warmupAdvanceTimers.delete(roomId);
                    const activeRoom = rooms.get(roomId);
                    if (
                      activeRoom &&
                      activeRoom.currentRound === 'warmup' &&
                      activeRoom.currentQuestionIndex === completedQuestionIndex
                    ) {
                      advanceWarmupQuestion(roomId, activeRoom);
                    }
                  }, 1000);
                  warmupAdvanceTimers.set(roomId, advanceTimer);
                }
              } else {
                recordAnswerResult(player, false, 0);
                if (!room.warmupState.attemptedPlayerIds.includes(player.id)) {
                  room.warmupState.attemptedPlayerIds.push(player.id);
                }
                addRoomLog(
                  room,
                  actionType === 'skip'
                    ? `⏭️ ${player.name} bỏ qua và mất quyền trả lời câu này.`
                    : `❌ ${player.name} trả lời sai và mất quyền trả lời câu này.`,
                  'warning'
                );

                if (allWarmupPlayersAttempted(room)) {
                  revealWarmupAnswer(room, 'all_failed');
                } else {
                  room.warmupState.phase = 'awaiting_buzzer';
                  room.timerSeconds = 30;
                  room.timerActive = true;
                }
              }
              room.activeBuzzer = undefined;
              room.buzzerLocked = room.warmupState.phase !== 'awaiting_buzzer';
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

            const submittedAnswer = room.accelerationState.playerSubmissions.find(
              (submission) => submission.playerId === player.id
            );
            if (submittedAnswer) {
              recordAnswerResult(
                player,
                submittedAnswer.isCorrect === true,
                submittedAnswer.pointsAwarded || 0
              );
            }

            const participatingPlayers = room.players.filter((p) => p.isOnline !== false);
            const allPlayersSubmitted =
              participatingPlayers.length > 0 &&
              participatingPlayers.every((p) =>
                room.accelerationState?.playerSubmissions.some((submission) => submission.playerId === p.id)
              );
            const accelerationQuestions = room.questions?.acceleration || [];
            const hasNextQuestion = room.currentQuestionIndex < accelerationQuestions.length - 1;

            if (allPlayersSubmitted && hasNextQuestion && !accelerationAdvanceTimers.has(roomId)) {
              const completedQuestionIndex = room.currentQuestionIndex;
              room.timerActive = false;
              addRoomLog(room, `Tất cả thí sinh đã hoàn thành. Tự động chuyển câu tiếp theo...`, 'info');

              const advanceTimer = setTimeout(() => {
                accelerationAdvanceTimers.delete(roomId);
                const activeRoom = rooms.get(roomId);
                if (
                  !activeRoom ||
                  activeRoom.currentRound !== 'acceleration' ||
                  activeRoom.currentQuestionIndex !== completedQuestionIndex ||
                  !activeRoom.accelerationState
                ) {
                  return;
                }

                activeRoom.currentQuestionIndex += 1;
                activeRoom.accelerationState.currentQuestionIndex = activeRoom.currentQuestionIndex;
                activeRoom.accelerationState.playerSubmissions = [];
                activeRoom.timerSeconds = 30;
                activeRoom.timerActive = true;
                addRoomLog(activeRoom, `Tự động chuyển sang câu Tăng tốc ${activeRoom.currentQuestionIndex + 1}.`, 'info');
                broadcastRoomState(roomId);
              }, 1500);

              accelerationAdvanceTimers.set(roomId, advanceTimer);
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
                recordAnswerResult(player, false, 0);
                addRoomLog(room, `⏭️ ${player.name} chọn BỎ QUA câu Về đích${starActive ? ` (-${deduct}đ do Ngôi sao hy vọng)` : ''}. Các thí sinh khác có thể BẤM CHUÔNG CƯỚP ĐIỂM!`, 'warning');
                room.finishState.turnPhase = 'stealer_buzzer';
              } else {
                const isCorrect = q ? checkAnswerCorrectness(answerText, q.answer) : false;
                if (isCorrect) {
                  const pts = starActive ? basePoints * 2 : basePoints;
                  player.score += pts;
                  recordAnswerResult(player, true, pts);
                  addRoomLog(room, `🎉 CHÍNH XÁC! ${player.name} trả lời ĐÚNG câu Về đích ("${answerText}")${starActive ? ' (CÓ NGÔI SAO HY VỌNG!)' : ''}! (+${pts}đ)`, 'success');
                  room.finishState.turnPhase = 'completed';
                  scheduleFinishAdvance(roomId, room);
                } else {
                  const deduct = starActive ? basePoints : 0;
                  if (deduct > 0) {
                    player.score = Math.max(0, player.score - deduct);
                  }
                  recordAnswerResult(player, false, 0);
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
                recordAnswerResult(player, false, 0);
                addRoomLog(room, `⏭️ ${player.name} chọn BỎ QUA cướp điểm.`, 'info');
              } else {
                const isCorrect = q ? checkAnswerCorrectness(answerText, q.answer) : false;
                if (isCorrect) {
                  player.score += basePoints;
                  recordAnswerResult(player, true, basePoints);
                  addRoomLog(room, `⚡ CƯỚP ĐIỂM THÀNH CÔNG! ${player.name} trả lời ĐÚNG ("${answerText}")! (+${basePoints}đ)`, 'success');
                } else {
                  const deduct = Math.round(basePoints / 2);
                  player.score = Math.max(0, player.score - deduct);
                  recordAnswerResult(player, false, 0);
                  addRoomLog(room, `❌ CƯỚP ĐIỂM THẤT BẠI! ${player.name} trả lời SAI ("${answerText}") (-${deduct}đ). Đáp án chuẩn: "${q?.answer || ''}"`, 'warning');
                }
              }
              room.activeBuzzer = undefined;
              room.buzzerLocked = false;
              room.finishState.turnPhase = 'completed';
              scheduleFinishAdvance(roomId, room);
            }
          }
          break;
        }

        case 'OPEN_OBSTACLE_CLUE': {
          const clueNum = payload?.clueNumber;
          const state = room.obstacleState;
          const currentSelectorId = state?.selectionOrder[state.selectionTurnIndex];
          if (
            role === 'player' &&
            playerId === currentSelectorId &&
            state?.phase === 'selecting_clue' &&
            room.questions?.obstacle
          ) {
            const clue = room.questions.obstacle.clues.find((c) => c.number === clueNum);
            if (clue && !clue.isOpened) {
              clue.isOpened = true;
              if (!state.openedClues.includes(clueNum)) {
                state.openedClues.push(clueNum);
              }
              state.currentClueIndex = clueNum;
              state.clueSubmissions = [];
              state.phase = 'answering_clue';
              room.timerSeconds = 30;
              room.timerActive = true;
              const selector = room.players.find((player) => player.id === playerId);
              addRoomLog(room, `${selector?.name || 'Thí sinh'} chọn Hàng ngang số ${clueNum}. Tất cả thí sinh có 30 giây trả lời.`, 'info');
            }
          }
          break;
        }

        case 'SUBMIT_OBSTACLE_CLUE_ANSWER': {
          const state = room.obstacleState;
          const player = room.players.find((candidate) => candidate.id === playerId);
          const clue = room.questions?.obstacle.clues.find(
            (candidate) => candidate.number === state?.currentClueIndex
          );
          if (
            room.currentRound !== 'obstacle' ||
            !state ||
            state.phase !== 'answering_clue' ||
            !player ||
            !clue ||
            state.eliminatedPlayerIds.includes(player.id) ||
            state.clueSubmissions.some((submission) => submission.playerId === player.id)
          ) {
            return;
          }

          const answer = String(payload?.answer || '').trim();
          if (!answer) return;
          const isCorrect = checkAnswerCorrectness(answer, clue.answer);
          state.clueSubmissions.push({ playerId: player.id, answer, isCorrect });
          if (isCorrect) {
            player.score += 10;
            recordAnswerResult(player, true, 10);
            addRoomLog(room, `✅ ${player.name} trả lời đúng Hàng ngang số ${clue.number} và được cộng 10 điểm.`, 'success');
          } else {
            recordAnswerResult(player, false, 0);
            addRoomLog(room, `❌ ${player.name} trả lời sai Hàng ngang số ${clue.number}.`, 'warning');
          }

          const eligiblePlayers = obstacleEligiblePlayers(room);
          const allSubmitted = eligiblePlayers.every((candidate) =>
            state.clueSubmissions.some((submission) => submission.playerId === candidate.id)
          );
          if (allSubmitted) {
            addRoomLog(room, 'Tất cả thí sinh hợp lệ đã trả lời. Chuyển quyền chọn hàng ngang.', 'info');
            advanceObstacleSelection(room);
          }
          break;
        }

        case 'GUESS_OBSTACLE_KEYWORD': {
          const player = room.players.find((p) => p.id === playerId);
          const state = room.obstacleState;
          if (
            !player ||
            !room.questions?.obstacle ||
            !state ||
            state.phase !== 'keyword_answering' ||
            room.activeBuzzer?.playerId !== player.id ||
            state.eliminatedPlayerIds.includes(player.id)
          ) {
            return;
          }

          const actionType: 'confirm' | 'skip' = payload?.actionType || 'confirm';
          const guess = (payload?.keyword || '').trim();
          const target = room.questions.obstacle.keyword;
          const isCorrect =
            actionType !== 'skip' && checkAnswerCorrectness(guess, target);

          if (isCorrect) {
            player.score += 40;
            recordAnswerResult(player, true, 40);
            state.keywordGuessed = true;
            state.keywordWinnerId = player.id;
            state.keywordPointsAwarded = 40;
            state.resumePhase = undefined;
            state.resumeTimerSeconds = undefined;
            room.questions.obstacle.isKeywordRevealed = true;
            addRoomLog(room, `🎉 ${player.name} giải đúng Chướng ngại vật ("${target}") và được cộng 40 điểm!`, 'success');
            initializeAccelerationRound(room);
            addRoomLog(room, 'Tự động chuyển sang vòng Tăng tốc.', 'success');
          } else {
            if (!state.eliminatedPlayerIds.includes(player.id)) {
              state.eliminatedPlayerIds.push(player.id);
            }
            recordAnswerResult(player, false, 0);
            addRoomLog(
              room,
              actionType === 'skip'
                ? `${player.name} bỏ qua và mất quyền tham gia phần thi Chướng ngại vật.`
                : `❌ ${player.name} đoán sai Chướng ngại vật và mất quyền trả lời tất cả câu hỏi còn lại của phần thi.`,
              'warning'
            );
            resumeObstacleAfterKeywordAttempt(room);
          }
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
            if (room.currentRound === 'warmup') {
              const pendingWarmupAdvance = warmupAdvanceTimers.get(roomId);
              if (pendingWarmupAdvance) {
                clearTimeout(pendingWarmupAdvance);
                warmupAdvanceTimers.delete(roomId);
              }
              advanceWarmupQuestion(roomId, room);
              break;
            }

            const pendingAccelerationAdvance = accelerationAdvanceTimers.get(roomId);
            if (pendingAccelerationAdvance) {
              clearTimeout(pendingAccelerationAdvance);
              accelerationAdvanceTimers.delete(roomId);
            }
            const pendingFinishAdvance = finishAdvanceTimers.get(roomId);
            if (pendingFinishAdvance) {
              clearTimeout(pendingFinishAdvance);
              finishAdvanceTimers.delete(roomId);
            }

            room.currentQuestionIndex += 1;

            if (room.currentRound === 'acceleration' && room.accelerationState) {
              room.accelerationState.currentQuestionIndex = room.currentQuestionIndex;
              room.accelerationState.playerSubmissions = [];
              room.timerSeconds = 30;
              room.timerActive = true;
            }

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

        case 'CANCEL_ROOM': {
          if (role !== 'admin') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ chủ phòng mới có quyền hủy phòng!' }));
            return;
          }

          const pendingAccelerationAdvance = accelerationAdvanceTimers.get(roomId);
          if (pendingAccelerationAdvance) {
            clearTimeout(pendingAccelerationAdvance);
            accelerationAdvanceTimers.delete(roomId);
          }
          const pendingWarmupAdvance = warmupAdvanceTimers.get(roomId);
          if (pendingWarmupAdvance) {
            clearTimeout(pendingWarmupAdvance);
            warmupAdvanceTimers.delete(roomId);
          }
          const pendingFinishAdvance = finishAdvanceTimers.get(roomId);
          if (pendingFinishAdvance) {
            clearTimeout(pendingFinishAdvance);
            finishAdvanceTimers.delete(roomId);
          }

          const cancelledMessage = JSON.stringify({
            type: 'ROOM_CANCELLED',
            payload: { roomCode: room.roomCode },
          });

          for (const [client, info] of clientRoomMap.entries()) {
            if (info.roomId === roomId) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(cancelledMessage);
              }
              clientRoomMap.delete(client);
            }
          }

          rooms.delete(roomId);
          return;
        }

        case 'RESET_GAME': {
          if (role !== 'admin') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Chỉ MC Chủ phòng mới có quyền đặt lại trận đấu!' }));
            return;
          }
          const pendingWarmupAdvance = warmupAdvanceTimers.get(roomId);
          if (pendingWarmupAdvance) {
            clearTimeout(pendingWarmupAdvance);
            warmupAdvanceTimers.delete(roomId);
          }
          const pendingFinishAdvance = finishAdvanceTimers.get(roomId);
          if (pendingFinishAdvance) {
            clearTimeout(pendingFinishAdvance);
            finishAdvanceTimers.delete(roomId);
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
      clientRoomMap.delete(ws);
      const room = rooms.get(info.roomId);
      const hasAnotherConnection = [...clientRoomMap.values()].some(
        (connection) =>
          connection.roomId === info.roomId && connection.playerId === info.playerId
      );

      if (room && info.playerId && !hasAnotherConnection) {
        const player = room.players.find((p) => p.id === info.playerId);
        if (player) {
          player.isOnline = false;
          addRoomLog(room, `${player.name} mất kết nối mạng.`, 'warning');
          broadcastRoomState(info.roomId);
        }
      }
    }
  });
});

async function startServer() {
  await initializeAccountStore();

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

startServer().catch((error) => {
  console.error('Không thể khởi động server:', error);
  process.exitCode = 1;
});
