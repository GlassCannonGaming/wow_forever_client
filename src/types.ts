export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageUrl?: string;
  pinnedZoneId?: string;
}

export interface MapPin {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  title: string;
  note: string;
  category: 'quest' | 'boss' | 'resource' | 'custom';
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

export interface InstructionConfig {
  voiceName: string;
  voicePitch: number;
  voiceRate: number;
  autoSpeak: boolean;
  responseStyle: 'concise' | 'tactical' | 'lore-rich';
  customDirectives: string;
  strictForeverOnly: boolean;
  memoryWindowHours: number;
}
