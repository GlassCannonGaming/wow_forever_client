import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Compass, MessageSquare, Sliders } from 'lucide-react';
import type {
  ChatMessage,
  ForeverDbPatch,
  ForeverDbSyncState,
  GearItem,
  InstructionConfig,
  MapPin,
  PlayerState,
  ProfessionRecipe,
} from './types';
import {
  buildSystemInstruction,
  DEFAULT_INSTRUCTION_CONFIG,
  DEFAULT_PLAYER_STATE,
  shouldGenerateVisualAnswer,
  shouldRunBackgroundPatchSync,
} from './utils/memory';
import { applyForeverDbPatches, searchCodex } from './utils/foreverDbParser';
import {
  BASE_FOREVERDB_VERSION,
  FOREVERDB_PATCH_DELTAS,
  INITIAL_GEAR_ITEMS,
  INITIAL_MAP_PINS,
  INITIAL_PROFESSION_RECIPES,
  LATEST_FOREVERDB_VERSION,
  WOW_FOREVER_REGIONS,
} from './data/wowForeverData';
import {
  type LocationLinkTarget,
  speakWithConfig,
  VoiceChatPanel,
} from './components/VoiceChatPanel';
import { type MapFocusTarget, WorldMapPanel } from './components/WorldMapPanel';
import { SettingsMemoryPanel } from './components/SettingsMemoryPanel';
import { DatabaseCodexPanel } from './components/DatabaseCodexPanel';
import { PWAInstallButton } from './components/PWAInstallButton';

type ActiveTab = 'companion' | 'map' | 'codex' | 'preferences';

const STORAGE_KEYS = {
  messages: 'forever_atlas_messages_v3',
  pins: 'forever_atlas_pins_v3',
  config: 'forever_atlas_config_v1',
  player: 'forever_atlas_player_v1',
  gear: 'forever_atlas_gear_v2',
  recipes: 'forever_atlas_recipes_v2',
  syncState: 'forever_atlas_patch_sync_v1',
  customMap: 'forever_atlas_custom_map_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const PREBUNDLED_DB = applyForeverDbPatches(
  INITIAL_GEAR_ITEMS,
  INITIAL_PROFESSION_RECIPES,
  INITIAL_MAP_PINS,
  BASE_FOREVERDB_VERSION,
  FOREVERDB_PATCH_DELTAS
);

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('companion');
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage<ChatMessage[]>(STORAGE_KEYS.messages, [
      {
        id: 'welcome-1',
        role: 'assistant',
        content:
          'Greetings, adventurer. The Chronicles of World of Warcraft: Forever are open before you. Click any region link such as The Cinder Maw (57.0, 51.0), Veridian Wood (17.0, 52.0), Ashpeak Mountains (50.0, 33.0), or Ebonis (87.0, 48.0) to center the World Map, or ask about bosses, tradeskills, and equipment.',
        timestamp: Date.now(),
      },
    ])
  );
  const [pins, setPins] = useState<MapPin[]>(() =>
    loadFromStorage<MapPin[]>(STORAGE_KEYS.pins, PREBUNDLED_DB.pins)
  );
  const [config, setConfig] = useState<InstructionConfig>(() => {
    const saved = loadFromStorage<Partial<InstructionConfig>>(
      STORAGE_KEYS.config,
      DEFAULT_INSTRUCTION_CONFIG
    );
    return {
      ...DEFAULT_INSTRUCTION_CONFIG,
      ...saved,
      voicePitch: typeof saved.voicePitch === 'number' ? saved.voicePitch : 1.0,
      voiceRate: typeof saved.voiceRate === 'number' ? saved.voiceRate : 1.05,
      voiceAccent: saved.voiceAccent || 'en-US',
      backgroundPatchSync:
        typeof saved.backgroundPatchSync === 'boolean' ? saved.backgroundPatchSync : true,
      strictForeverOnly: true,
      closedWorldMode: true,
    };
  });
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    loadFromStorage<PlayerState>(STORAGE_KEYS.player, DEFAULT_PLAYER_STATE)
  );
  const [gear, setGear] = useState<GearItem[]>(() =>
    loadFromStorage<GearItem[]>(STORAGE_KEYS.gear, PREBUNDLED_DB.gear).map((g) => ({
      ...g,
      buildVersion: '16001',
      provenance: g.provenance || 'ForeverDB (16001)',
    }))
  );
  const [recipes, setRecipes] = useState<ProfessionRecipe[]>(() =>
    loadFromStorage<ProfessionRecipe[]>(STORAGE_KEYS.recipes, PREBUNDLED_DB.recipes).map(
      (r) => ({
        ...r,
        buildVersion: '16001',
        provenance: r.provenance || 'ForeverDB (16001)',
      })
    )
  );
  const [syncState, setSyncState] = useState<ForeverDbSyncState>(() =>
    loadFromStorage<ForeverDbSyncState>(STORAGE_KEYS.syncState, {
      currentPatchVersion: PREBUNDLED_DB.latestVersion || LATEST_FOREVERDB_VERSION,
      lastCheckedAt: Date.now(),
      appliedPatches: PREBUNDLED_DB.appliedPatchVersions,
      status: 'synced',
    })
  );
  const [customMapUrl, setCustomMapUrl] = useState<string | null>(() =>
    loadFromStorage<string | null>(STORAGE_KEYS.customMap, null)
  );

  const [highlightedRegionId, setHighlightedRegionId] = useState<string | null>('cinder-maw');
  const [mapFocusTarget, setMapFocusTarget] = useState<MapFocusTarget | null>(null);
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
    localStorage.setItem(STORAGE_KEYS.gear, JSON.stringify(gear));
  }, [gear]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.syncState, JSON.stringify(syncState));
  }, [syncState]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.customMap, JSON.stringify(customMapUrl));
  }, [customMapUrl]);

  const handleSelectLocationLink = (target: LocationLinkTarget) => {
    if (target.regionId) {
      setHighlightedRegionId(target.regionId);
    }
    setMapFocusTarget({
      regionId: target.regionId,
      x: target.x,
      y: target.y,
      zoom: 1.85,
      timestamp: Date.now(),
    });
  };

  const detectAndHighlightRegion = (text: string) => {
    const lower = text.toLowerCase();
    const matched = WOW_FOREVER_REGIONS.find((r) => lower.includes(r.name.toLowerCase()));
    if (matched) {
      setHighlightedRegionId(matched.id);
      setMapFocusTarget({
        regionId: matched.id,
        x: matched.x,
        y: matched.y,
        zoom: 1.85,
        timestamp: Date.now(),
      });
    }
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
      const { matchedGear, matchedRecipes } = searchCodex(text, gear, recipes);
      const systemInstruction = buildSystemInstruction(
        config,
        playerState,
        nextMessages,
        Date.now(),
        { gear: matchedGear, recipes: matchedRecipes }
      );
      const requestVisual = shouldGenerateVisualAnswer(text);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemInstruction,
          requestVisual,
          history: nextMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        imageUrl?: string;
        error?: string;
      };
      const replyText = data.reply || data.error || 'No response received.';
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        imageUrl: data.imageUrl,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      detectAndHighlightRegion(replyText);
      if (config.autoSpeak) {
        speakWithConfig(replyText, config);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Unable to reach the Forever Atlas archive server. Please check your connection.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPin = (pin: Omit<MapPin, 'id' | 'createdAt'>) => {
    setPins((prev) => [
      {
        ...pin,
        id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
  };

  const handleUpdatePin = (updated: MapPin) => {
    setPins((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDeletePin = (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  };

  const handleCheckForPatches = async () => {
    setSyncState((prev) => ({ ...prev, status: 'checking' }));
    try {
      const res = await fetch('/api/foreverdb/patches');
      if (!res.ok) throw new Error('Patch manifest unreachable');
      const data = (await res.json()) as {
        latestBuild: string;
        patches: ForeverDbPatch[];
        checkedAt: number;
      };
      const merged = applyForeverDbPatches(
        gear,
        recipes,
        pins,
        syncState.currentPatchVersion,
        data.patches || FOREVERDB_PATCH_DELTAS
      );
      if (merged.updatedCount > 0) {
        setGear(merged.gear);
        setRecipes(merged.recipes);
        setPins(merged.pins);
      }
      setSyncState((prev) => ({
        currentPatchVersion: merged.latestVersion,
        lastCheckedAt: data.checkedAt || Date.now(),
        appliedPatches: Array.from(
          new Set([...prev.appliedPatches, ...merged.appliedPatchVersions])
        ),
        status: merged.updatedCount > 0 ? 'updated' : 'synced',
      }));
    } catch {
      setSyncState((prev) => ({
        ...prev,
        lastCheckedAt: Date.now(),
        status: 'synced',
      }));
    }
  };

  useEffect(() => {
    if (!shouldRunBackgroundPatchSync(config)) return;
    handleCheckForPatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.backgroundPatchSync]);

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'companion', label: 'Companion', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'map', label: 'World Map', icon: <Compass className="w-4 h-4" /> },
    { id: 'codex', label: 'Codex & DB', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences', icon: <Sliders className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0907] text-[#f3ead8]">
      {/* Top Bar Contract: 3 zones separated by gap-8 in WoW dark stone & brass frame */}
      <header className="sticky top-0 z-30 border-b-2 border-[#6e562f] bg-[#120f0b]/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.85)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="/"
            className="font-display text-lg font-bold tracking-wider text-[#ffd100] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap shrink-0"
          >
            Forever Atlas
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'text-[#ffd100] border-b-2 border-[#ffd100]'
                    : 'text-[#c9b38c] hover:text-[#fff3d1]'
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

      {/* Main Content with Framer Motion Layout & Fade Transition */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'companion' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-5 flex flex-col">
                  <VoiceChatPanel
                    messages={messages}
                    isLoading={isLoading}
                    instructionConfig={config}
                    regions={WOW_FOREVER_REGIONS}
                    onSendMessage={handleSendMessage}
                    onToggleAutoSpeak={() =>
                      setConfig((prev) => ({ ...prev, autoSpeak: !prev.autoSpeak }))
                    }
                    onSelectLocationLink={handleSelectLocationLink}
                  />
                </div>
                <div className="lg:col-span-7">
                  <WorldMapPanel
                    regions={WOW_FOREVER_REGIONS}
                    pins={pins}
                    highlightedRegionId={highlightedRegionId}
                    focusTarget={mapFocusTarget}
                    customMapUrl={customMapUrl}
                    onSelectRegion={setHighlightedRegionId}
                    onAddPin={handleAddPin}
                    onUpdatePin={handleUpdatePin}
                    onDeletePin={handleDeletePin}
                    onChangeCustomMapUrl={setCustomMapUrl}
                  />
                </div>
              </div>
            )}

            {activeTab === 'map' && (
              <WorldMapPanel
                regions={WOW_FOREVER_REGIONS}
                pins={pins}
                highlightedRegionId={highlightedRegionId}
                focusTarget={mapFocusTarget}
                customMapUrl={customMapUrl}
                onSelectRegion={setHighlightedRegionId}
                onAddPin={handleAddPin}
                onUpdatePin={handleUpdatePin}
                onDeletePin={handleDeletePin}
                onChangeCustomMapUrl={setCustomMapUrl}
              />
            )}

            {activeTab === 'codex' && (
              <DatabaseCodexPanel
                gear={gear}
                recipes={recipes}
                syncState={syncState}
                onCheckForPatches={handleCheckForPatches}
                onPinItemSource={(pin) => {
                  handleAddPin(pin);
                  setMapFocusTarget({
                    x: pin.x,
                    y: pin.y,
                    zoom: 1.85,
                    timestamp: Date.now(),
                  });
                  setActiveTab('map');
                }}
              />
            )}

            {activeTab === 'preferences' && (
              <SettingsMemoryPanel
                config={config}
                playerState={playerState}
                syncState={syncState}
                onSaveConfig={setConfig}
                onUpdatePlayerState={setPlayerState}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Tab Bar (Android Second-Screen Thumb Zone) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[#6e562f] bg-[#120f0b]/95 backdrop-blur-md grid grid-cols-4 h-16"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
              activeTab === item.id ? 'text-[#ffd100]' : 'text-[#b8a382]'
            }`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
