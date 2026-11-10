import type { ChatMessage, InstructionConfig, PlayerState } from '../types';

export const DEFAULT_INSTRUCTION_CONFIG: InstructionConfig = {
  voiceName: 'default',
  voicePitch: 1.0,
  voiceRate: 1.05,
  autoSpeak: false,
  responseStyle: 'concise',
  customDirectives:
    'Prioritize actionable raid/dungeon mechanics, Eternal Forge crafting routes, and exact zone coordinates.',
  strictForeverOnly: true,
  memoryWindowHours: 72,
};

export const DEFAULT_PLAYER_STATE: PlayerState = {
  characterName: 'Kaelen',
  classSpec: 'Chronomancer Mage',
  level: 60,
  location: 'The Cinder Maw · Ashpeak Mountains',
  gearScore: 412,
  equippedGear: [
    ' Mantle of the Eternal Forge (Tier F1)',
    'Staff of Unbound Time',
    'Signet of the Abyssal Sea',
  ],
  addonConnected: false,
  lastSyncedAt: null,
};

/**
 * Filters conversation history to messages within the specified hour window (default 72h).
 */
export function filterRecentHistory(
  messages: ChatMessage[],
  hours: number = 72,
  now: number = Date.now()
): ChatMessage[] {
  const cutoff = now - hours * 60 * 60 * 1000;
  return messages.filter((m) => m.timestamp >= cutoff);
}

/**
 * Summarizes the player's recent 72-hour context for initialization.
 */
export function extractPlayerSummary(
  recentMessages: ChatMessage[],
  player: PlayerState
): string {
  const userTopics = recentMessages
    .filter((m) => m.role === 'user')
    .slice(-5)
    .map((m) => m.content.trim().slice(0, 120));

  const lines = [
    `Character: ${player.characterName} (Level ${player.level} ${player.classSpec})`,
    `Current Location: ${player.location}`,
    `Gear Score: ${player.gearScore} | Key Gear: ${player.equippedGear.join(', ')}`,
    `Addon Bridge: ${player.addonConnected ? 'Live Sync Active' : 'Manual / Offline Snapshot'}`,
  ];

  if (userTopics.length > 0) {
    lines.push(`Recent 72h Queries: ${userTopics.join(' | ')}`);
  } else {
    lines.push('Recent 72h Queries: None recorded yet.');
  }

  return lines.join('\n');
}

/**
 * Builds the strict WoW Forever system instruction with user-editable preferences
 * and 72-hour initialization memory.
 */
export function buildSystemInstruction(
  config: InstructionConfig,
  player: PlayerState,
  recentMessages: ChatMessage[],
  now: number = Date.now()
): string {
  const recent = filterRecentHistory(recentMessages, config.memoryWindowHours, now);
  const summary = extractPlayerSummary(recent, player);

  const styleGuide =
    config.responseStyle === 'concise'
      ? 'Keep answers crisp, scannable, and under 4 sentences unless asked for a full breakdown.'
      : config.responseStyle === 'tactical'
      ? 'Structure answers with bulleted mechanics, cooldown timings, and positional callouts.'
      : 'Include rich World of Warcraft: Forever lore context alongside practical gameplay guidance.';

  const strictRule = config.strictForeverOnly
    ? `STRICT VERSION LOCK: You must ONLY answer using "World of Warcraft: Forever" (WoW Forever) documentation, mechanics, zones, classes, and data. NEVER reference, mix, or fall back to Classic, Retail, Burning Crusade, Wrath, Cataclysm, or any other version of World of Warcraft. If a user asks about another version, politely state that you are locked exclusively to World of Warcraft: Forever.`
    : `Focus primarily on World of Warcraft: Forever documentation and data.`;

  return [
    `You are Forever Atlas, a real-time second-screen companion for World of Warcraft: Forever.`,
    strictRule,
    `INITIALIZATION MEMORY (Last ${config.memoryWindowHours} Hours):\n${summary}`,
    `RESPONSE STYLE:\n${styleGuide}`,
    `USER CUSTOM DIRECTIVES:\n${config.customDirectives || 'None.'}`,
    `MAP INTEGRATION: When mentioning a WoW Forever zone (e.g., The Wyvern's Tooth, Veridian Wood, The Cinder Maw, Ashpeak Mountains, Whispering Woods, Ebonis, Silvercliff, The Abyssal Sea), mention its exact name clearly so the companion map can highlight it.`,
  ].join('\n\n');
}
