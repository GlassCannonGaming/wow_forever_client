import React, { useEffect, useState } from 'react';
import { Compass, Image as ImageIcon, MessageSquare, Sliders } from 'lucide-react';
import type { ChatMessage, InstructionConfig, MapPin, PlayerState } from './types';
import {
  buildSystemInstruction,
  DEFAULT_INSTRUCTION_CONFIG,
  DEFAULT_PLAYER_STATE,
} from './utils/memory';
import { INITIAL_MAP_PINS, WOW_FOREVER_REGIONS } from './data/wowForeverData';
import { VoiceChatPanel } from './components/VoiceChatPanel';
import { WorldMapPanel } from './components/WorldMapPanel';
import { ImageForgePanel, type GeneratedAsset } from './components/ImageForgePanel';
import { SettingsMemoryPanel } from './components/SettingsMemoryPanel';
import { PWAInstallButton } from './components/PWAInstallButton';

type ActiveTab = 'companion' | 'map' | 'forge' | 'settings';

const STORAGE_KEYS = {
  messages: 'forever_atlas_messages_v1',
  pins: 'forever_atlas_pins_v1',
  config: 'forever_atlas_config_v1',
  player: 'forever_atlas_player_v1',
  assets: 'forever_atlas_assets_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('companion');
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage<ChatMessage[]>(STORAGE_KEYS.messages, [
      {
        id: 'welcome-1',
        role: 'assistant',
        content:
          'Welcome to Forever Atlas. I am locked exclusively to World of Warcraft: Forever documentation and have reviewed your last 72 hours of player context. Ask about any zone, boss mechanic, or Eternal Forge route.',
        timestamp: Date.now(),
      },
    ])
  );
  const [pins, setPins] = useState<MapPin[]>(() =>
    loadFromStorage<MapPin[]>(STORAGE_KEYS.pins, INITIAL_MAP_PINS)
  );
  const [config, setConfig] = useState<InstructionConfig>(() =>
    loadFromStorage<InstructionConfig>(STORAGE_KEYS.config, DEFAULT_INSTRUCTION_CONFIG)
  );
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    loadFromStorage<PlayerState>(STORAGE_KEYS.player, DEFAULT_PLAYER_STATE)
  );
  const [assets, setAssets] = useState<GeneratedAsset[]>(() =>
    loadFromStorage<GeneratedAsset[]>(STORAGE_KEYS.assets, [])
  );
  const [highlightedRegionId, setHighlightedRegionId] = useState<string | null>('cinder-maw');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.pins, JSON.stringify(pins));
  }, [pins]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.player, JSON.stringify(playerState));
  }, [playerState]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(assets));
  }, [assets]);

  const detectAndHighlightRegion = (text: string) => {
    const lower = text.toLowerCase();
    const matched = WOW_FOREVER_REGIONS.find((r) => lower.includes(r.name.toLowerCase()));
    if (matched) {
      setHighlightedRegionId(matched.id);
    }
  };

  const speakIfEnabled = (text: string) => {
    if (!config.autoSpeak || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = config.voicePitch;
    utterance.rate = config.voiceRate;
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    detectAndHighlightRegion(text);
    setIsLoading(true);

    try {
      const systemInstruction = buildSystemInstruction(config, playerState, nextMessages);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemInstruction,
          history: nextMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const replyText = data.reply || data.error || 'No response received.';
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      detectAndHighlightRegion(replyText);
      speakIfEnabled(replyText);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Unable to reach Forever Atlas server. Please check your connection.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPin = (pin: Omit<MapPin, 'id' | 'createdAt'>) => {
    setPins((prev) => [
      ...prev,
      {
        ...pin,
        id: `pin-${Date.now()}`,
        createdAt: Date.now(),
      },
    ]);
  };

  const handleDeletePin = (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'companion', label: 'Companion', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'map', label: 'World Map', icon: <Compass className="w-4 h-4" /> },
    { id: 'forge', label: 'Image Forge', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'settings', label: 'Instructions', icon: <Sliders className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0f14] text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0d0f14]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="/"
            className="font-display text-lg font-bold tracking-wide text-amber-400 whitespace-nowrap shrink-0"
          >
            Forever Atlas
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'text-amber-300 border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-8">
        {activeTab === 'companion' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-5 flex flex-col">
              <VoiceChatPanel
                messages={messages}
                isLoading={isLoading}
                instructionConfig={config}
                onSendMessage={handleSendMessage}
                onToggleAutoSpeak={() =>
                  setConfig((prev) => ({ ...prev, autoSpeak: !prev.autoSpeak }))
                }
              />
            </div>
            <div className="lg:col-span-7">
              <WorldMapPanel
                regions={WOW_FOREVER_REGIONS}
                pins={pins}
                highlightedRegionId={highlightedRegionId}
                onSelectRegion={setHighlightedRegionId}
                onAddPin={handleAddPin}
                onDeletePin={handleDeletePin}
              />
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <WorldMapPanel
            regions={WOW_FOREVER_REGIONS}
            pins={pins}
            highlightedRegionId={highlightedRegionId}
            onSelectRegion={setHighlightedRegionId}
            onAddPin={handleAddPin}
            onDeletePin={handleDeletePin}
          />
        )}

        {activeTab === 'forge' && (
          <ImageForgePanel
            assets={assets}
            onAddAsset={(asset) => setAssets((prev) => [asset, ...prev])}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsMemoryPanel
            config={config}
            playerState={playerState}
            messages={messages}
            onSaveConfig={setConfig}
            onUpdatePlayerState={setPlayerState}
            onClearHistory={() => setMessages([])}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (Android Second-Screen Thumb Zone) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-[#0d0f14]/95 backdrop-blur-md grid grid-cols-4 h-16"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === item.id ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
