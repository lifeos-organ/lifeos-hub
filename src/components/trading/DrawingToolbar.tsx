import React from 'react';
import { DrawingToolType } from '../../types';
import {
  MousePointer,
  Minus,
  MoveUpRight,
  Square,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Magnet,
  Camera,
  Percent,
  Circle,
  Type,
  Maximize,
  TrendingUp,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';

interface DrawingToolbarProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  isMagnetEnabled: boolean;
  onToggleMagnet: () => void;
  onClearDrawings: () => void;
  drawingsCount: number;
  onTakeScreenshot: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  isMagnetEnabled,
  onToggleMagnet,
  onClearDrawings,
  drawingsCount,
  onTakeScreenshot,
  isLocked = false,
  onToggleLock,
  isHidden = false,
  onToggleHide,
}) => {
  const tools: { id: DrawingToolType; label: string; shortcut?: string; icon: React.ReactNode }[] = [
    { id: 'cursor', label: 'Crosshair / Pan', shortcut: 'Esc', icon: <MousePointer className="w-3.5 h-3.5" /> },
    { id: 'trendline', label: 'Trendline', shortcut: 'Alt+T', icon: <MoveUpRight className="w-3.5 h-3.5" /> },
    { id: 'ray', label: 'Ray Line', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'horizontal_line', label: 'Horizontal Ray (Support/Resistance)', shortcut: 'Alt+H', icon: <Minus className="w-3.5 h-3.5" /> },
    { id: 'vertical_line', label: 'Vertical Line (Time marker)', icon: <div className="w-0.5 h-3.5 bg-current mx-auto" /> },
    { id: 'fibonacci', label: 'Fibonacci Retracement', shortcut: 'Alt+F', icon: <Percent className="w-3.5 h-3.5" /> },
    { id: 'rectangle', label: 'Order Block / FVG Zone', shortcut: 'Alt+R', icon: <Square className="w-3.5 h-3.5" /> },
    { id: 'circle', label: 'Marker Circle', icon: <Circle className="w-3.5 h-3.5" /> },
    { id: 'price_range', label: 'Price Range / Measure', icon: <Maximize className="w-3.5 h-3.5" /> },
    { id: 'text', label: 'Text Annotation', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'long_position', label: 'Long Position (R:R Tool)', icon: <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500" /> },
    { id: 'short_position', label: 'Short Position (R:R Tool)', icon: <ArrowDownCircle className="w-3.5 h-3.5 text-rose-500" /> },
  ];

  return (
    <div className="flex sm:flex-col items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-slate-950/95 border border-neutral-200/90 dark:border-slate-800 shadow-md backdrop-blur-md shrink-0 select-none z-20">
      {tools.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelectTool(t.id)}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
            className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 shadow-2xs font-semibold'
                : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-100 hover:bg-neutral-100 dark:hover:bg-slate-900 border border-transparent'
            }`}
          >
            {t.icon}

            {/* Tooltip on hover */}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1.5 z-50 whitespace-nowrap px-2 py-1 rounded-md bg-neutral-900 dark:bg-slate-900 border border-neutral-700 dark:border-slate-700 text-[10px] text-white dark:text-slate-200 font-mono shadow-xl pointer-events-none">
              <span>{t.label}</span>
              {t.shortcut && (
                <span className="px-1 py-0.5 rounded bg-neutral-800 dark:bg-slate-800 text-[9px] text-neutral-400">
                  {t.shortcut}
                </span>
              )}
            </div>
          </button>
        );
      })}

      <div className="h-px w-full bg-neutral-200 dark:bg-slate-800/80 my-0.5 hidden sm:block" />

      {/* Magnet Snap Mode */}
      <button
        onClick={onToggleMagnet}
        title={isMagnetEnabled ? 'Magnet Snap ON (Snaps to OHLC)' : 'Magnet Snap OFF'}
        className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
          isMagnetEnabled
            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'text-neutral-400 dark:text-slate-500 hover:text-neutral-700 dark:hover:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-900'
        }`}
      >
        <Magnet className="w-3.5 h-3.5" />
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 whitespace-nowrap px-2 py-1 rounded-md bg-neutral-900 dark:bg-slate-900 border border-neutral-700 dark:border-slate-700 text-[10px] text-white dark:text-slate-200 font-mono shadow-xl pointer-events-none">
          {isMagnetEnabled ? 'Magnet Snap: Active' : 'Magnet Snap: Off'}
        </div>
      </button>

      {/* Lock drawings */}
      {onToggleLock && (
        <button
          onClick={onToggleLock}
          title={isLocked ? 'Unlock All Drawings' : 'Lock All Drawings'}
          className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
            isLocked
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 dark:text-slate-500 hover:text-neutral-700 dark:hover:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-900'
          }`}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 whitespace-nowrap px-2 py-1 rounded-md bg-neutral-900 dark:bg-slate-900 border border-neutral-700 dark:border-slate-700 text-[10px] text-white dark:text-slate-200 font-mono shadow-xl pointer-events-none">
            {isLocked ? 'Drawings Locked' : 'Lock Drawings'}
          </div>
        </button>
      )}

      {/* Hide drawings */}
      {onToggleHide && (
        <button
          onClick={onToggleHide}
          title={isHidden ? 'Show All Drawings' : 'Hide All Drawings'}
          className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
            isHidden
              ? 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400 border border-neutral-500/30'
              : 'text-neutral-400 dark:text-slate-500 hover:text-neutral-700 dark:hover:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-900'
          }`}
        >
          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 whitespace-nowrap px-2 py-1 rounded-md bg-neutral-900 dark:bg-slate-900 border border-neutral-700 dark:border-slate-700 text-[10px] text-white dark:text-slate-200 font-mono shadow-xl pointer-events-none">
            {isHidden ? 'Drawings Hidden' : 'Hide Drawings'}
          </div>
        </button>
      )}

      {/* Clear Drawings */}
      {drawingsCount > 0 && (
        <button
          onClick={onClearDrawings}
          title={`Clear ${drawingsCount} Drawing(s)`}
          className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer relative group"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 whitespace-nowrap px-2 py-1 rounded-md bg-neutral-900 dark:bg-slate-900 border border-neutral-700 dark:border-slate-700 text-[10px] text-rose-300 font-mono shadow-xl pointer-events-none">
            Clear {drawingsCount} Object(s)
          </div>
        </button>
      )}

      {/* Screenshot export */}
      <button
        onClick={onTakeScreenshot}
        title="Capture Chart Snapshot"
        className="p-1.5 rounded-lg text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-900 transition-colors cursor-pointer relative group"
      >
        <Camera className="w-3.5 h-3.5" />
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 whitespace-nowrap px-2 py-1 rounded-md bg-neutral-900 dark:bg-slate-900 border border-neutral-700 dark:border-slate-700 text-[10px] text-white dark:text-slate-200 font-mono shadow-xl pointer-events-none">
          Chart Snapshot
        </div>
      </button>
    </div>
  );
};

