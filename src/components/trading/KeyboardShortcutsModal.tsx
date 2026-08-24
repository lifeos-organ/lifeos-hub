import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Keyboard, Command, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const shortcutGroups = [
    {
      category: 'Chart Navigation & Replay',
      shortcuts: [
        { key: 'Space', description: 'Play / Pause Historical Replay' },
        { key: '→ / ←', description: 'Step Forward / Backward 1 Replay Candle' },
        { key: '1, 5, 0', description: 'Quick-switch timeframe (1m, 5m, 15m, 1H, 1D)' },
        { key: 'F', description: 'Toggle Fullscreen Mode' },
        { key: 'Alt + R', description: 'Reset Chart Scale and Auto-fit Viewport' },
      ],
    },
    {
      category: 'Drawing & Measurement Tools',
      shortcuts: [
        { key: 'Alt + T', description: 'Activate Trendline Tool' },
        { key: 'Alt + H', description: 'Activate Horizontal Support/Resistance Ray' },
        { key: 'Alt + F', description: 'Activate Fibonacci Retracement Tool' },
        { key: 'Alt + R', description: 'Activate Rectangle / Order Block Zone' },
        { key: 'Del / Backspace', description: 'Delete Selected Chart Drawing' },
        { key: 'Esc', description: 'Cancel Current Drawing / Reset to Cursor' },
      ],
    },
    {
      category: 'Terminal & Execution',
      shortcuts: [
        { key: 'Cmd / Ctrl + K', description: 'Open Universal Symbol Search' },
        { key: 'Shift + B', description: 'Execute Instant Market Buy (Paper Trading)' },
        { key: 'Shift + S', description: 'Execute Instant Market Sell (Paper Trading)' },
        { key: 'Alt + P', description: 'Open Position Risk & Sizing Calculator' },
        { key: 'Alt + I', description: 'Open Technical Indicators Modal' },
        { key: 'Alt + A', description: 'Open Active Alerts Manager' },
      ],
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Terminal Keyboard Shortcuts" maxWidth="2xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-100 dark:bg-slate-900 border border-neutral-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                Institutional Hotkey Engine
              </div>
              <div className="text-xs text-neutral-500 dark:text-slate-400">
                Low-latency terminal shortcuts for active intraday execution and market analysis.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-neutral-200 dark:bg-slate-800 text-neutral-700 dark:text-slate-300">
            <Command className="w-3 h-3" />
            <span>PRO MODE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortcutGroups.map((group, idx) => (
            <div
              key={group.category}
              className={`p-4 rounded-xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 ${
                idx === 2 ? 'md:col-span-2' : ''
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-3">
                {group.category}
              </div>
              <div className="space-y-2">
                {group.shortcuts.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-slate-900 last:border-0"
                  >
                    <span className="text-neutral-600 dark:text-slate-300">{item.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 text-[11px] font-mono font-bold text-neutral-800 dark:text-slate-200 shadow-xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onClose}>
            Got It (Esc)
          </Button>
        </div>
      </div>
    </Modal>
  );
};
