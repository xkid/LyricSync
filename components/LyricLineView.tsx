
import React from 'react';
import { LyricLine } from '../types.ts';

interface LyricLineViewProps {
  line: LyricLine;
  isActive: boolean;
}

const LyricLineView: React.FC<LyricLineViewProps> = ({ line, isActive }) => {
  return (
    <div 
      className={`transition-all duration-500 py-6 px-4 rounded-xl mb-4 flex flex-col items-center text-center
        ${isActive ? 'bg-indigo-600/20 scale-105 shadow-lg border border-indigo-500/30' : 'opacity-40 grayscale-[0.5]'}
      `}
    >
      <div className="text-sm font-medium text-indigo-400 mb-1 tracking-widest uppercase">
        {line.romanization}
      </div>
      <div className={`text-2xl md:text-3xl font-bold mb-2 ${isActive ? 'text-white' : 'text-slate-300'}`}>
        {line.text}
      </div>
      <div className="text-lg text-slate-400 italic">
        {line.translation}
      </div>
    </div>
  );
};

export default LyricLineView;
