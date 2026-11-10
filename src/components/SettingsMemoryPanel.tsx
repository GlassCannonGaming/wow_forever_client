import React, { useEffect, useState } from 'react';
import { RefreshCw, Save, ShieldCheck } from 'lucide-react';
import type { ChatMessage, InstructionConfig, PlayerState } from '../types';
import { extractPlayerSummary, filterRecentHistory } from '../utils/memory';

interface SettingsMemoryPanelProps {
  config: InstructionConfig;
  playerState: PlayerState;
  messages: ChatMessage[];
  onSaveConfig: (next: InstructionConfig) => void;
  onUpdatePlayerState: (next: PlayerState) => void;
  onClearHistory: () => void;
}

export const SettingsMemoryPanel: React.FC<SettingsMemoryPanelProps> = ({
  config,
  playerState,
  messages,
  onSaveConfig,
  onUpdatePlayerState,
  onClearHistory,
}) => {
  const [draft, setDraft] = useState<InstructionConfig>(config);
  const [playerDraft, setPlayerDraft] = useState<PlayerState>(playerState);
  const [voices, setVoices] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    setPlayerDraft(playerState);
  }, [playerState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices().map((v) => v.name);
      setVoices(Array.from(new Set(list)));
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const recentMessages = filterRecentHistory(messages, draft.memoryWindowHours);
  const memorySummary = extractPlayerSummary(recentMessages, playerDraft);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(draft);
    onUpdatePlayerState(playerDraft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleSimulateAddonSync = () => {
    const synced: PlayerState = {
      ...playerDraft,
      addonConnected: true,
      lastSyncedAt: Date.now(),
    };
    setPlayerDraft(synced);
    onUpdatePlayerState(synced);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Instruction Set Editor */}
      <section className="rounded-xl border border-slate-800 bg-[#141720] p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Instruction Set &amp; Voice Preferences
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize how the Forever Companion speaks, formats answers, and enforces version boundaries.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-300">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>WoW Forever Lock</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="voice-select" className="block text-xs font-medium text-slate-300 mb-1.5">
              AI Voice
            </label>
            <select
              id="voice-select"
              value={draft.voiceName}
              onChange={(e) => setDraft({ ...draft, voiceName: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="default">System Default Voice</option>
              {voices.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="response-style" className="block text-xs font-medium text-slate-300 mb-1.5">
              Response Style
            </label>
            <select
              id="response-style"
              value={draft.responseStyle}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  responseStyle: e.target.value as InstructionConfig['responseStyle'],
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="concise">Concise Second-Screen</option>
              <option value="tactical">Tactical / Raid Callouts</option>
              <option value="lore-rich">Lore-Rich Explorer</option>
            </select>
          </div>

          <div>
            <label htmlFor="voice-rate" className="block text-xs font-medium text-slate-300 mb-1.5">
              Speech Rate ({draft.voiceRate.toFixed(2)}x)
            </label>
            <input
              id="voice-rate"
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              value={draft.voiceRate}
              onChange={(e) => setDraft({ ...draft, voiceRate: Number(e.target.value) })}
              className="w-full accent-amber-500 mt-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="custom-directives" className="block text-xs font-medium text-slate-300 mb-1.5">
            Custom Directives
          </label>
          <textarea
            id="custom-directives"
            rows={3}
            value={draft.customDirectives}
            onChange={(e) => setDraft({ ...draft, customDirectives: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-[#0d0f14] px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.strictForeverOnly}
              onChange={(e) => setDraft({ ...draft, strictForeverOnly: e.target.checked })}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span>Strictly lock responses to World of Warcraft: Forever only</span>
          </label>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-500 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{savedNotice ? 'Saved' : 'Save Preferences'}</span>
          </button>
        </div>
      </section>

      {/* 72-Hour Memory & Future Addon Bridge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-800 bg-[#141720] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">
              72-Hour Initialization Memory
            </h3>
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              Clear History
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Reviewed automatically on initialization ({recentMessages.length} messages in last 72h).
          </p>
          <pre className="rounded-lg border border-slate-800 bg-[#0d0f14] p-3.5 text-xs font-mono-tabular text-slate-300 whitespace-pre-wrap leading-relaxed">
            {memorySummary}
          </pre>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#141720] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">
              Player &amp; Future Addon Bridge
            </h3>
            <button
              type="button"
              onClick={handleSimulateAddonSync}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sync Addon</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="char-name" className="block text-xs text-slate-400 mb-1">
                Character
              </label>
              <input
                id="char-name"
                type="text"
                value={playerDraft.characterName}
                onChange={(e) => setPlayerDraft({ ...playerDraft, characterName: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-1.5 text-sm text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="char-level" className="block text-xs text-slate-400 mb-1">
                Level
              </label>
              <input
                id="char-level"
                type="number"
                min={1}
                max={60}
                value={playerDraft.level}
                onChange={(e) =>
                  setPlayerDraft({ ...playerDraft, level: Number(e.target.value) || 1 })
                }
                className="w-full rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-1.5 text-sm font-mono-tabular text-slate-100"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="char-location" className="block text-xs text-slate-400 mb-1">
                Current Location
              </label>
              <input
                id="char-location"
                type="text"
                value={playerDraft.location}
                onChange={(e) => setPlayerDraft({ ...playerDraft, location: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-1.5 text-sm text-slate-100"
              />
            </div>
          </div>
        </section>
      </div>
    </form>
  );
};
