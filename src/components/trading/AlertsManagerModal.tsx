import React, { useState } from 'react';
import { TradingAlert, MarketSymbol } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Storage } from '../../lib/storage';
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  Volume2,
} from 'lucide-react';

interface AlertsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  alerts: TradingAlert[];
  onAlertsChanged: () => void;
}

export const AlertsManagerModal: React.FC<AlertsManagerModalProps> = ({
  isOpen,
  onClose,
  currentSymbol,
  symbols,
  alerts,
  onAlertsChanged,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(currentSymbol.symbol);
  const [alertType, setAlertType] = useState<TradingAlert['type']>('price_above');
  const [targetPrice, setTargetPrice] = useState(currentSymbol.currentPrice * 1.02);
  const [isRecurring, setIsRecurring] = useState(false);

  const activeSymbolObj = symbols.find((s) => s.symbol === selectedSymbol) || currentSymbol;

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    let desc = '';
    const formattedPrice = targetPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: activeSymbolObj.decimals,
    });

    switch (alertType) {
      case 'price_above':
        desc = `Price crosses ABOVE ${formattedPrice}`;
        break;
      case 'price_below':
        desc = `Price crosses BELOW ${formattedPrice}`;
        break;
      case 'rsi_overbought':
        desc = `RSI(14) crosses ABOVE 70 Overbought threshold`;
        break;
      case 'rsi_oversold':
        desc = `RSI(14) crosses BELOW 30 Oversold threshold`;
        break;
      case 'ema_cross':
        desc = `EMA 9 crosses EMA 21 Momentum Convergence`;
        break;
    }

    Storage.addTradingAlert({
      symbol: selectedSymbol,
      type: alertType,
      targetValue: Number(targetPrice),
      conditionDescription: desc,
      active: true,
      recurring: isRecurring,
    });

    onAlertsChanged();
  };

  const handleDeleteAlert = (id: string) => {
    Storage.deleteTradingAlert(id);
    onAlertsChanged();
  };

  const handleToggleAlert = (id: string, currentActive: boolean) => {
    Storage.updateTradingAlert(id, { active: !currentActive });
    onAlertsChanged();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Price & Indicator Alerts Engine" maxWidth="2xl">
      <div className="space-y-6">
        {/* Create Alert Form */}
        <form
          onSubmit={handleCreateAlert}
          className="p-4 rounded-2xl bg-neutral-50 dark:bg-slate-900/80 border border-neutral-200 dark:border-slate-800 space-y-4"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              Configure New Real-Time Alert
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              Current: ${activeSymbolObj.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-slate-400 mb-1">
                Asset Symbol
              </label>
              <select
                value={selectedSymbol}
                onChange={(e) => {
                  setSelectedSymbol(e.target.value);
                  const sym = symbols.find((s) => s.symbol === e.target.value);
                  if (sym) setTargetPrice(Number((sym.currentPrice * 1.02).toFixed(sym.decimals)));
                }}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-950 border border-neutral-300 dark:border-slate-700 text-neutral-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
              >
                {symbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-slate-400 mb-1">
                Condition Trigger
              </label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as TradingAlert['type'])}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-950 border border-neutral-300 dark:border-slate-700 text-neutral-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="price_above">Price Crosses Above</option>
                <option value="price_below">Price Crosses Below</option>
                <option value="rsi_overbought">RSI Crosses &gt; 70 (Overbought)</option>
                <option value="rsi_oversold">RSI Crosses &lt; 30 (Oversold)</option>
                <option value="ema_cross">EMA 9 / 21 Crossover</option>
              </select>
            </div>

            {(alertType === 'price_above' || alertType === 'price_below') && (
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-slate-400 mb-1">
                  Target Price ($)
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-950 border border-neutral-300 dark:border-slate-700 text-neutral-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Recurring Trigger (Alert multiple times on re-entry)</span>
            </label>

            <Button type="submit" variant="primary" size="sm">
              <Bell className="w-3.5 h-3.5 mr-1.5" />
              Set Alert
            </Button>
          </div>
        </form>

        {/* Existing Alerts List */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-3 flex items-center justify-between">
            <span>Active & Triggered Alerts ({alerts.length})</span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Audio Chime Enabled</span>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-neutral-100/50 dark:bg-slate-900/40 border border-neutral-200 dark:border-slate-800 text-xs text-neutral-500 dark:text-slate-400">
              No active alerts configured. Use the form above to track price breakouts and indicator thresholds.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    al.triggered
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                      : al.active
                      ? 'bg-white dark:bg-slate-950 border-neutral-200 dark:border-slate-800'
                      : 'bg-neutral-100/60 dark:bg-slate-900/40 border-neutral-200/60 dark:border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        al.triggered
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : al.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-neutral-200 dark:bg-slate-800 text-neutral-400'
                      }`}
                    >
                      {al.triggered ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-xs text-neutral-900 dark:text-slate-100">
                          {al.symbol}
                        </span>
                        <span className="text-xs text-neutral-600 dark:text-slate-300">
                          {al.conditionDescription}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Created {new Date(al.createdAt).toLocaleTimeString()}</span>
                        {al.triggered && al.triggeredAt && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            • Triggered {new Date(al.triggeredAt).toLocaleTimeString()}
                          </span>
                        )}
                        {al.recurring && <span className="text-emerald-500">• Recurring</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAlert(al.id, al.active)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        al.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-neutral-200 dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:bg-neutral-300'
                      }`}
                    >
                      {al.active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(al.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
