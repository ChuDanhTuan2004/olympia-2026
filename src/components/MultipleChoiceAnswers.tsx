import React from 'react';

interface MultipleChoiceAnswersProps {
  choices?: string[];
  onSelect: (answer: string) => void;
  disabled?: boolean;
  selectedAnswer?: string;
}

const LABELS = ['A', 'B', 'C', 'D'];

export const MultipleChoiceAnswers: React.FC<MultipleChoiceAnswersProps> = ({
  choices = [],
  onSelect,
  disabled = false,
  selectedAnswer,
}) => (
  <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Chọn đáp án">
    {choices.slice(0, 4).map((choice, index) => {
      const isSelected = selectedAnswer === choice;
      return (
        <button
          key={`${index}-${choice}`}
          type="button"
          onClick={() => onSelect(choice)}
          disabled={disabled}
          aria-pressed={isSelected}
          className={`group flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
            isSelected
              ? 'border-amber-300 bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20'
              : 'border-blue-400/40 bg-blue-950/55 text-white hover:border-amber-300/70 hover:bg-blue-900/70'
          }`}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black ${
            isSelected ? 'bg-slate-950 text-amber-300' : 'bg-blue-800/80 text-amber-300'
          }`}>
            {LABELS[index]}
          </span>
          <span className="leading-snug">{choice}</span>
        </button>
      );
    })}
  </div>
);
