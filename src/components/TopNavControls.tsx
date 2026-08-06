import React from 'react';
import { BookOpen } from 'lucide-react';

interface TopNavControlsProps {
  onOpenRules: () => void;
}

export const TopNavControls: React.FC<TopNavControlsProps> = ({
  onOpenRules,
}) => {
  return (
    <div className="fixed top-3 right-4 z-40 flex items-center gap-2 animate-fadeIn">
      {/* Rules Icon Button */}
      <button
        onClick={onOpenRules}
        title="Xem Luật Chơi"
        className="olympia-top-control group relative flex items-center justify-center w-10 h-10 rounded-2xl border shadow-lg shadow-black/20 transition-all active:scale-95"
      >
        <BookOpen className="w-5 h-5 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
        <span className="sr-only">Luật Chơi</span>
      </button>
    </div>
  );
};
