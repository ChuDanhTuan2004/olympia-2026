import React, { useState } from 'react';
import { X, BookOpen, Zap, KeyRound, Rocket, Trophy, CheckCircle2, ShieldCheck } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'warmup' | 'obstacle' | 'acceleration' | 'finish'>('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden transition-all text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 text-white flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                LUẬT CHƠI DÀNH CHO THÍ SINH
              </h3>
              <p className="text-xs text-neutral-400 font-semibold">
                Đường Lên Đỉnh Olympia • Dễ hiểu & Chuẩn xác
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5 stroke-[1.75]" />
          </button>
        </div>

        {/* Round Filter Tabs */}
        <div className="flex items-center gap-1.5 px-6 pt-4 pb-2 overflow-x-auto scrollbar-none border-b border-neutral-800 bg-neutral-900">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            📋 TẤT CẢ VÒNG
          </button>
          <button
            onClick={() => setActiveTab('warmup')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'warmup'
                ? 'bg-white text-black shadow-md'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            ⚡ KHỞI ĐỘNG
          </button>
          <button
            onClick={() => setActiveTab('obstacle')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'obstacle'
                ? 'bg-white text-black shadow-md'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            🧩 CHƯỚNG NGẠI VẬT
          </button>
          <button
            onClick={() => setActiveTab('acceleration')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'acceleration'
                ? 'bg-white text-black shadow-md'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            🚀 TĂNG TỐC
          </button>
          <button
            onClick={() => setActiveTab('finish')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'finish'
                ? 'bg-white text-black shadow-md'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            🏆 VỀ ĐÍCH
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-6 overflow-y-auto space-y-6 text-neutral-200 text-sm">
          {/* General Advice */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-white shrink-0 mt-0.5 stroke-[1.75]" />
            <div>
              <div className="font-extrabold text-white text-xs uppercase tracking-wider mb-0.5">
                BÍ QUYẾT DÀNH CHO THÍ SINH
              </div>
              <p className="text-xs text-neutral-300 font-medium">
                Mỗi ô nhập câu trả lời đều trang bị 2 nút trực quan dưới khung nhập: <strong className="text-white">BỎ QUA</strong> và <strong className="text-white">XÁC NHẬN</strong>.
                Hệ thống tự động chấm điểm chính xác ngay sau khi bạn bấm Xác Nhận.
              </p>
            </div>
          </div>

          {/* Warmup Rules */}
          {(activeTab === 'all' || activeTab === 'warmup') && (
            <section className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 font-black text-white text-base">
                <span className="p-1.5 rounded-xl bg-neutral-800 text-white">
                  <Zap className="w-4 h-4 stroke-[1.75]" />
                </span>
                VÒNG 1: KHỞI ĐỘNG
              </div>
              <ul className="space-y-2 text-xs sm:text-sm font-medium text-neutral-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Các thí sinh cùng thi đấu giành quyền trả lời bằng nút bấm chuông.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Thí sinh bấm chuông nhanh nhất có quyền nhập đáp án và bấm Xác Nhận hoặc Bỏ Qua.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Trả lời đúng cộng ngay <strong className="text-white">10 điểm</strong>. Trả lời sai không bị trừ điểm.</span>
                </li>
              </ul>
            </section>
          )}

          {/* Obstacle Rules */}
          {(activeTab === 'all' || activeTab === 'obstacle') && (
            <section className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 font-black text-white text-base">
                <span className="p-1.5 rounded-xl bg-neutral-800 text-white">
                  <KeyRound className="w-4 h-4 stroke-[1.75]" />
                </span>
                VÒNG 2: VƯỢT CHƯỚNG NGẠI VẬT
              </div>
              <ul className="space-y-2 text-xs sm:text-sm font-medium text-neutral-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Nhiệm vụ là giải mã Từ Khóa bí ẩn gồm một số chữ cái dựa vào các mảnh gợi ý.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>MC lần lượt mở các hàng ngang. Mọi thí sinh cùng trả lời để tích lũy điểm hàng ngang.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Thí sinh có thể bấm chuông giải Chướng Ngại Vật bất kỳ lúc nào. Giải đúng nhận tới <strong className="text-white">80 điểm</strong> và kết thúc vòng thi. Giải sai sẽ dừng cuộc chơi vòng này.</span>
                </li>
              </ul>
            </section>
          )}

          {/* Acceleration Rules */}
          {(activeTab === 'all' || activeTab === 'acceleration') && (
            <section className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 font-black text-white text-base">
                <span className="p-1.5 rounded-xl bg-neutral-800 text-white">
                  <Rocket className="w-4 h-4 stroke-[1.75]" />
                </span>
                VÒNG 3: TĂNG TỐC
              </div>
              <ul className="space-y-2 text-xs sm:text-sm font-medium text-neutral-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Gồm 4 câu hỏi tư duy hình ảnh và logic với độ khó tăng dần.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Tất cả thí sinh đồng thời gõ đáp án và bấm Xác Nhận trước khi hết giờ.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Điểm thưởng dành cho thí sinh có đáp án chính xác theo thứ tự tốc độ:
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono font-bold text-white">
                      <div className="bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700">⚡ Nộp nhanh nhất: +40 điểm</div>
                      <div className="bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700">⚡ Nộp nhanh nhì: +30 điểm</div>
                      <div className="bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700">⚡ Nộp nhanh ba: +20 điểm</div>
                      <div className="bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700">⚡ Nộp nhanh tư: +10 điểm</div>
                    </div>
                  </span>
                </li>
              </ul>
            </section>
          )}

          {/* Finish Rules */}
          {(activeTab === 'all' || activeTab === 'finish') && (
            <section className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 font-black text-white text-base">
                <span className="p-1.5 rounded-xl bg-neutral-800 text-white">
                  <Trophy className="w-4 h-4 stroke-[1.75]" />
                </span>
                VÒNG 4: VỀ ĐÍCH
              </div>
              <ul className="space-y-2 text-xs sm:text-sm font-medium text-neutral-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Mỗi thí sinh lần lượt chọn gói câu hỏi cho phần thi chính của mình.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Trước khi trả lời, thí sinh có thể chọn đặt <strong className="text-white">Ngôi Sao Hy Vọng</strong>. Trả lời đúng nhận gấp đôi điểm, trả lời sai bị trừ số điểm tương ứng của câu hỏi.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Nếu thí sinh lượt chính trả lời sai hoặc bỏ qua, các thí sinh còn lại có thể bấm chuông cướp điểm. Cướp điểm đúng nhận trọn điểm câu hỏi, cướp điểm sai bị trừ một nửa số điểm.</span>
                </li>
              </ul>
            </section>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-white hover:bg-neutral-200 text-black font-extrabold rounded-2xl text-xs shadow-md transition-all active:scale-95"
          >
            ĐÃ HIỂU RÕ LUẬT CHƠI
          </button>
        </div>
      </div>
    </div>
  );
};
