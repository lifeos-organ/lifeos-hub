import React, { useState } from 'react';
import {
  MarketSymbol,
  CandleStick,
  Timeframe,
  ChartType,
  DrawingToolType,
  ChartDrawing,
  IndicatorConfig,
} from '../../types';
import { TradingChartCanvas } from './TradingChartCanvas';
import { LayoutGrid, Columns2, Rows2, Square, Link2, Unlink } from 'lucide-react';

interface MultiChartLayoutProps {
  symbols: MarketSymbol[];
  primarySymbol: MarketSymbol;
  primaryCandles: CandleStick[];
  primaryTimeframe: Timeframe;
  primaryChartType: ChartType;
  indicators: IndicatorConfig;
  activeDrawingTool: DrawingToolType;
  drawings: ChartDrawing[];
  onUpdateDrawings: (drawings: ChartDrawing[]) => void;
  isMagnetEnabled: boolean;
  onOpenIndicatorsModal: () => void;
}

export type MultiChartMode = '1x1' | '1x2' | '2x1' | '2x2';

export const MultiChartLayout: React.FC<MultiChartLayoutProps> = ({
  symbols,
  primarySymbol,
  primaryCandles,
  primaryTimeframe,
  primaryChartType,
  indicators,
  activeDrawingTool,
  drawings,
  onUpdateDrawings,
  isMagnetEnabled,
  onOpenIndicatorsModal,
}) => {
  const [layoutMode, setLayoutMode] = useState<MultiChartMode>('1x1');
  const [syncTimeframe, setSyncTimeframe] = useState(true);
  const [syncSymbol, setSyncSymbol] = useState(false);

  // Secondary sub-charts state
  const [subChart1Symbol, setSubChart1Symbol] = useState<MarketSymbol>(symbols[1] || primarySymbol);
  const [subChart1Tf, setSubChart1Tf] = useState<Timeframe>('1H');
  const [subChart2Symbol, setSubChart2Symbol] = useState<MarketSymbol>(symbols[2] || primarySymbol);
  const [subChart2Tf, setSubChart2Tf] = useState<Timeframe>('4H');
  const [subChart3Symbol, setSubChart3Symbol] = useState<MarketSymbol>(symbols[3] || primarySymbol);
  const [subChart3Tf, setSubChart3Tf] = useState<Timeframe>('1D');

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Top Layout Control Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-neutral-400 mr-1 hidden sm:inline">
            Layout:
          </span>
          <button
            onClick={() => setLayoutMode('1x1')}
            title="Single Chart (1x1)"
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
              layoutMode === '1x1'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-slate-100 hover:bg-neutral-100 dark:hover:bg-slate-900'
            }`}
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayoutMode('1x2')}
            title="Split Vertical (2 Charts)"
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
              layoutMode === '1x2'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-slate-100 hover:bg-neutral-100 dark:hover:bg-slate-900'
            }`}
          >
            <Columns2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayoutMode('2x1')}
            title="Split Horizontal (2 Charts)"
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
              layoutMode === '2x1'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-slate-100 hover:bg-neutral-100 dark:hover:bg-slate-900'
            }`}
          >
            <Rows2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayoutMode('2x2')}
            title="Quad Grid (4 Charts)"
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
              layoutMode === '2x2'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-slate-100 hover:bg-neutral-100 dark:hover:bg-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setSyncTimeframe(!syncTimeframe)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] font-semibold ${
              syncTimeframe
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Sync Timeframe</span>
          </button>
        </div>
      </div>

      {/* Dynamic Grid Container */}
      <div className="flex-1 min-h-0 relative">
        {layoutMode === '1x1' && (
          <div className="w-full h-full">
            <TradingChartCanvas
              symbol={primarySymbol}
              rawCandles={primaryCandles}
              timeframe={primaryTimeframe}
              onChangeTimeframe={() => {}}
              chartType={primaryChartType}
              onChangeChartType={() => {}}
              indicators={indicators}
              onOpenIndicatorsModal={onOpenIndicatorsModal}
              activeDrawingTool={activeDrawingTool}
              drawings={drawings}
              onUpdateDrawings={onUpdateDrawings}
              isMagnetEnabled={isMagnetEnabled}
            />
          </div>
        )}

        {layoutMode === '1x2' && (
          <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 divide-x divide-neutral-200 dark:divide-slate-800">
            <div className="h-full">
              <TradingChartCanvas
                symbol={primarySymbol}
                rawCandles={primaryCandles}
                timeframe={primaryTimeframe}
                onChangeTimeframe={() => {}}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool={activeDrawingTool}
                drawings={drawings}
                onUpdateDrawings={onUpdateDrawings}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
            <div className="h-full">
              <TradingChartCanvas
                symbol={syncSymbol ? primarySymbol : subChart1Symbol}
                rawCandles={primaryCandles}
                timeframe={syncTimeframe ? primaryTimeframe : subChart1Tf}
                onChangeTimeframe={(tf) => setSubChart1Tf(tf)}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool="cursor"
                drawings={[]}
                onUpdateDrawings={() => {}}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
          </div>
        )}

        {layoutMode === '2x1' && (
          <div className="w-full h-full grid grid-rows-2 divide-y divide-neutral-200 dark:divide-slate-800">
            <div className="h-full">
              <TradingChartCanvas
                symbol={primarySymbol}
                rawCandles={primaryCandles}
                timeframe={primaryTimeframe}
                onChangeTimeframe={() => {}}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool={activeDrawingTool}
                drawings={drawings}
                onUpdateDrawings={onUpdateDrawings}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
            <div className="h-full">
              <TradingChartCanvas
                symbol={syncSymbol ? primarySymbol : subChart1Symbol}
                rawCandles={primaryCandles}
                timeframe={syncTimeframe ? primaryTimeframe : subChart1Tf}
                onChangeTimeframe={(tf) => setSubChart1Tf(tf)}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool="cursor"
                drawings={[]}
                onUpdateDrawings={() => {}}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
          </div>
        )}

        {layoutMode === '2x2' && (
          <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 grid-rows-2 divide-x divide-y divide-neutral-200 dark:divide-slate-800">
            <div className="h-full">
              <TradingChartCanvas
                symbol={primarySymbol}
                rawCandles={primaryCandles}
                timeframe={primaryTimeframe}
                onChangeTimeframe={() => {}}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool={activeDrawingTool}
                drawings={drawings}
                onUpdateDrawings={onUpdateDrawings}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
            <div className="h-full">
              <TradingChartCanvas
                symbol={syncSymbol ? primarySymbol : subChart1Symbol}
                rawCandles={primaryCandles}
                timeframe={syncTimeframe ? primaryTimeframe : subChart1Tf}
                onChangeTimeframe={(tf) => setSubChart1Tf(tf)}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool="cursor"
                drawings={[]}
                onUpdateDrawings={() => {}}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
            <div className="h-full">
              <TradingChartCanvas
                symbol={syncSymbol ? primarySymbol : subChart2Symbol}
                rawCandles={primaryCandles}
                timeframe={syncTimeframe ? primaryTimeframe : subChart2Tf}
                onChangeTimeframe={(tf) => setSubChart2Tf(tf)}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool="cursor"
                drawings={[]}
                onUpdateDrawings={() => {}}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
            <div className="h-full">
              <TradingChartCanvas
                symbol={syncSymbol ? primarySymbol : subChart3Symbol}
                rawCandles={primaryCandles}
                timeframe={syncTimeframe ? primaryTimeframe : subChart3Tf}
                onChangeTimeframe={(tf) => setSubChart3Tf(tf)}
                chartType={primaryChartType}
                onChangeChartType={() => {}}
                indicators={indicators}
                onOpenIndicatorsModal={onOpenIndicatorsModal}
                activeDrawingTool="cursor"
                drawings={[]}
                onUpdateDrawings={() => {}}
                isMagnetEnabled={isMagnetEnabled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
