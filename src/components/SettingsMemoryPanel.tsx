import React, { useEffect, useState } from 'react';
import { Database, RotateCcw, Save, Volume2, Wifi, WifiOff } from 'lucide-react';
import type {
  ForeverDbSyncState,
  InstructionConfig,
  PlayerState,
  VoiceAccent,
} from '../types';
import {
  DEFAULT_INSTRUCTION_CONFIG,
  VOICE_ACCENT_LABELS,
} from '../utils/memory';
import { speakWithConfig } from './VoiceChatPanel';

interface SettingsMemoryPanelProps {
  config: InstructionConfig;
  playerState: PlayerState;
  syncState?: ForeverDbSyncState;
  onSaveConfig: (next: InstructionConfig) => void;
  onUpdatePlayerState: (next: PlayerState) => void;
}

export const SettingsMemoryPanel: React.FC<SettingsMemoryPanelProps> = ({
  config,
  playerState,
  syncState,
  onSaveConfig,
  onUpdatePlayerState,
}) => {
  const [draft, setDraft] = useState<InstructionConfig>(config);
  const [playerDraft, setPlayerDraft] = useState<PlayerState>(playerState);
  const [voices, setVoices] = useState<Array<{ name: string; lang: string }>>([]);
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
      const list = window.speechSynthesis.getVoices().map((v) => ({
        name: v.name,
        lang: v.lang,
      }));
      setVoices(list);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleToggleBackgroundSync = () => {
    const nextValue = !draft.backgroundPatchSync;
    const nextConfig: InstructionConfig = {
      ...draft,
      backgroundPatchSync: nextValue,
      strictForeverOnly: true,
      closedWorldMode: true,
    };
    setDraft(nextConfig);
    onSaveConfig(nextConfig);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...draft,
      strictForeverOnly: true,
      closedWorldMode: true,
    });
    onUpdatePlayerState(playerDraft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleResetDefaults = () => {
    setDraft(DEFAULT_INSTRUCTION_CONFIG);
    onSaveConfig(DEFAULT_INSTRUCTION_CONFIG);
  };

  const handleTestVoice = () => {
    const sample = `Greetings ${playerDraft.characterName}. The chronicles of ${playerDraft.location} await your command.`;
    speakWithConfig(sample, draft);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Voice & Companion Preferences */}
      <section className="rounded-lg wow-frame p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#4a391f] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#ffd100] tracking-wide">
              Companion Voice &amp; Demeanor
            </h2>
            <p className="text-xs text-[#b8a382] mt-0.5">
              Calibrate vocal pitch, speaking pace, regional accent, and companion guidance style.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestVoice}
            className="flex items-center gap-1.5 rounded wow-button-secondary px-3 py-1.5 text-xs font-medium cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Test Voice</span>
          </button>
        </div>

        {/* Voice Controls Grid: Accent, Pitch, Speed, Engine */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="voice-accent" className="block text-xs font-medium text-[#e6d5b8] mb-1.5">
              Voice Accent
            </label>
            <select
              id="voice-accent"
              value={draft.voiceAccent}
              onChange={(e) =>
                setDraft({ ...draft, voiceAccent: e.target.value as VoiceAccent })
              }
              className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
            >
              {(Object.keys(VOICE_ACCENT_LABELS) as VoiceAccent[]).map((acc) => (
                <option key={acc} value={acc}>
                  {VOICE_ACCENT_LABELS[acc]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="voice-pitch" className="block text-xs font-medium text-[#e6d5b8] mb-1.5">
              Voice Pitch ({draft.voicePitch.toFixed(2)})
            </label>
            <input
              id="voice-pitch"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={draft.voicePitch}
              onChange={(e) => setDraft({ ...draft, voicePitch: Number(e.target.value) })}
              className="w-full accent-[#ffd100] mt-2"
            />
            <div className="flex justify-between text-[11px] text-[#857256] font-mono-tabular mt-1">
              <span>0.50 (Deep)</span>
              <span>1.00</span>
              <span>2.00 (High)</span>
            </div>
          </div>

          <div>
            <label htmlFor="voice-rate" className="block text-xs font-medium text-[#e6d5b8] mb-1.5">
              Voice Speed ({draft.voiceRate.toFixed(2)}x)
            </label>
            <input
              id="voice-rate"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={draft.voiceRate}
              onChange={(e) => setDraft({ ...draft, voiceRate: Number(e.target.value) })}
              className="w-full accent-[#ffd100] mt-2"
            />
            <div className="flex justify-between text-[11px] text-[#857256] font-mono-tabular mt-1">
              <span>0.50x (Slow)</span>
              <span>1.00x</span>
              <span>2.00x (Rapid)</span>
            </div>
          </div>

          <div>
            <label htmlFor="voice-select" className="block text-xs font-medium text-[#e6d5b8] mb-1.5">
              Voice Timbre
            </label>
            <select
              id="voice-select"
              value={draft.voiceName}
              onChange={(e) => setDraft({ ...draft, voiceName: e.target.value })}
              className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
            >
              <option value="default">Auto-Match by Accent ({draft.voiceAccent})</option>
              {voices.map((v) => (
                <option key={`${v.name}-${v.lang}`} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="response-style" className="block text-xs font-medium text-[#e6d5b8] mb-1.5">
              Companion Demeanor
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
              className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
            >
              <option value="concise">Concise Scout (Brief Field Answers)</option>
              <option value="tactical">Veteran Raid Leader (Mechanics &amp; Callouts)</option>
              <option value="lore-rich">Chronicler Loremaster (Rich Lore &amp; Context)</option>
            </select>
          </div>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2.5 text-sm text-[#f3ead8] cursor-pointer">
              <input
                type="checkbox"
                checked={draft.autoSpeak}
                onChange={(e) => setDraft({ ...draft, autoSpeak: e.target.checked })}
                className="w-4 h-4 accent-[#ffd100] rounded"
              />
              <span>Speak companion answers aloud automatically</span>
            </label>
          </div>
        </div>
      </section>

      {/* Data Usage & ForeverDB Patch Sync */}
      <section className="rounded-lg wow-frame p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#4a391f] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#ffd100] tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-[#ffd100]" aria-hidden="true" />
              <span>Data Usage &amp; ForeverDB Patch Sync</span>
            </h3>
            <p className="text-xs text-[#b8a382] mt-0.5">
              Control background network synchronization for World of Warcraft: Forever post-patch database updates.
            </p>
          </div>

          <span
            data-testid="patch-sync-status-badge"
            className={`inline-flex items-center gap-1.5 rounded wow-inset px-3 py-1 text-xs font-mono-tabular ${
              draft.backgroundPatchSync ? 'text-[#1eff00]' : 'text-[#ffd100]'
            }`}
          >
            {draft.backgroundPatchSync ? (
              <>
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Auto-Sync Enabled</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Data Saver · Manual Sync Only</span>
              </>
            )}
          </span>
        </div>

        <div className="rounded wow-inset p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[#f3ead8]">
              Background Sync for ForeverDB Patches
            </div>
            <p className="text-xs text-[#b8a382] leading-relaxed max-w-2xl">
              {draft.backgroundPatchSync
                ? 'Automatically checks for and downloads incremental ForeverDB (Build 16001) gear, tradeskill recipe, and map waypoint deltas when patches release.'
                : 'Background patch downloads are paused to conserve mobile and metered data. Built-in ForeverDB records remain available offline, and you can still check for patches manually in the Codex & DB tab.'}
            </p>
            {syncState && (
              <p className="text-[11px] font-mono-tabular text-[#857256] pt-1">
                Active Database: Build {syncState.currentPatchVersion} · Applied Deltas:{' '}
                {syncState.appliedPatches.length > 0
                  ? syncState.appliedPatches.join(', ')
                  : 'Base 16001.4'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={draft.backgroundPatchSync}
              aria-label="Toggle background sync for ForeverDB patches"
              data-testid="toggle-background-patch-sync"
              onClick={handleToggleBackgroundSync}
              className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                draft.backgroundPatchSync
                  ? 'bg-[#3b2d16] border-[#ffd100]'
                  : 'bg-[#14100c] border-[#4a391f]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                  draft.backgroundPatchSync
                    ? 'translate-x-6 bg-[#ffd100] shadow-[0_0_8px_rgba(255,209,0,0.6)]'
                    : 'translate-x-1 bg-[#857256]'
                }`}
              />
            </button>
            <span className="text-xs font-semibold text-[#e6d5b8] min-w-[4.5rem]">
              {draft.backgroundPatchSync ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </section>

      {/* Active Character Profile */}
      <section className="rounded-lg wow-frame p-5 space-y-4">
        <div className="border-b border-[#4a391f] pb-3">
          <h3 className="text-base font-bold text-[#ffd100] tracking-wide">
            Adventurer Roster Profile
          </h3>
          <p className="text-xs text-[#b8a382] mt-0.5">
            Your active character details help the companion tailor zone routes, class tactics, and equipment guidance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="char-name" className="block text-xs font-medium text-[#e6d5b8] mb-1">
              Character Name
            </label>
            <input
              id="char-name"
              type="text"
              value={playerDraft.characterName}
              onChange={(e) => setPlayerDraft({ ...playerDraft, characterName: e.target.value })}
              className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
            />
          </div>

          <div>
            <label htmlFor="char-spec" className="block text-xs font-medium text-[#e6d5b8] mb-1">
              Class &amp; Specialization
            </label>
            <input
              id="char-spec"
              type="text"
              value={playerDraft.classSpec}
              onChange={(e) => setPlayerDraft({ ...playerDraft, classSpec: e.target.value })}
              className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
            />
          </div>

          <div>
            <label htmlFor="char-level" className="block text-xs font-medium text-[#e6d5b8] mb-1">
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
              className="w-full rounded wow-inset px-3 py-2 text-sm font-mono-tabular text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
            />
          </div>

          <div>
            <label htmlFor="char-location" className="block text-xs font-medium text-[#e6d5b8] mb-1">
              Current Territory
            </label>
            <input
              id="char-location"
              type="text"
              value={playerDraft.location}
              onChange={(e) => setPlayerDraft({ ...playerDraft, location: e.target.value })}
              className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 rounded wow-button-secondary px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Restore Defaults</span>
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 rounded wow-button-primary px-5 py-2 text-sm font-semibold transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{savedNotice ? 'Preferences Saved' : 'Save Preferences'}</span>
          </button>
        </div>
      </section>
    </form>
  );
};
