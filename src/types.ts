export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageUrl?: string;
  pinnedZoneId?: string;
  citedCodexCount?: number;
}

export type ForeverProvenance = 'Seen in Forever' | 'ForeverDB (16001)';

export type PinCategory = 'quest' | 'treasure' | 'rare' | 'boss' | 'resource' | 'custom';

export interface MapPin {
  id: string;
  x: number; // percentage 0-100 (supports 1 decimal place e.g. 57.4)
  y: number; // percentage 0-100
  title: string;
  note: string;
  category: PinCategory;
  zoneName?: string;
  buildVersion?: '16001';
  provenance?: ForeverProvenance;
  createdAt: number;
}

export interface MapRegion {
  id: string;
  name: string;
  continent: string;
  levelRange: string;
  x: number;
  y: number;
  radius: number;
  description: string;
  highlighted?: boolean;
}

export interface GearItem {
  id: string;
  name: string;
  slot: 'Head' | 'Shoulder' | 'Chest' | 'Weapon' | 'Trinket' | 'Ring' | 'Hands' | 'Legs';
  quality: 'Epic' | 'Rare' | 'Legendary' | 'Uncommon';
  itemLevel: number;
  requiredLevel: number;
  stats: string[];
  source: string;
  zone: string;
  coords?: { x: number; y: number };
  buildVersion: '16001';
  provenance: ForeverProvenance;
}

export interface ProfessionRecipe {
  id: string;
  name: string;
  profession:
    | 'Blacksmithing'
    | 'Alchemy'
    | 'Enchanting'
    | 'Tailoring'
    | 'Engineering'
    | 'Jewelcrafting';
  skillRequired: number;
  reagents: Array<{ name: string; count: number }>;
  effectOrStats: string;
  source: string;
  cooldown?: string;
  buildVersion: '16001';
  provenance: ForeverProvenance;
}

export interface PlayerState {
  characterName: string;
  classSpec: string;
  level: number;
  location: string;
  gearScore: number;
  equippedGear: string[];
  addonConnected: boolean;
  lastSyncedAt: number | null;
}

export type VoiceAccent =
  | 'en-US'
  | 'en-GB'
  | 'en-AU'
  | 'en-IE'
  | 'en-SCO'
  | 'en-ZA';

export interface InstructionConfig {
  voiceName: string;
  voicePitch: number; // 0.5 to 2.0
  voiceRate: number; // 0.5 to 2.0
  voiceAccent: VoiceAccent;
  autoSpeak: boolean;
  backgroundPatchSync: boolean; // Controls automatic background sync for ForeverDB patches
  responseStyle: 'concise' | 'tactical' | 'lore-rich';
  customDirectives: string;
  strictForeverOnly: boolean;
  closedWorldMode: boolean; // Enforces Closed-World ForeverDB (16001) Grounding Lock
  memoryWindowHours: number;
}

export interface ForeverDbPatch {
  patchVersion: string; // e.g., "16001.5"
  buildVersion: '16001';
  releasedAt: string;
  title: string;
  notes: string[];
  gear: GearItem[];
  recipes: ProfessionRecipe[];
  pins: Omit<MapPin, 'id' | 'createdAt'>[];
}

export interface ForeverDbSyncState {
  currentPatchVersion: string;
  lastCheckedAt: number;
  appliedPatches: string[];
  status: 'synced' | 'checking' | 'updated';
}

