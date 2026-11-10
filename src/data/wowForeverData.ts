import type { MapPin, MapRegion } from '../types';

export const WOW_FOREVER_REGIONS: MapRegion[] = [
  {
    id: 'wyverns-tooth',
    name: "The Wyvern's Tooth",
    continent: 'Western Reach',
    levelRange: '15–28',
    x: 18,
    y: 26,
    radius: 10,
    description:
      'Jagged northern ridge of the Western Reach. Home to Skybound Drake nests and the Tempest Spire dungeon.',
  },
  {
    id: 'veridian-wood',
    name: 'Veridian Wood',
    continent: 'Western Reach',
    levelRange: '25–40',
    x: 17,
    y: 52,
    radius: 11,
    description:
      'Ancient emerald canopy infused with Forever Ley-lines. Contains the Druid Sanctum of Thornveil.',
  },
  {
    id: 'stormkeep',
    name: 'Stormkeep',
    continent: 'Western Reach',
    levelRange: '1–60 (Capital)',
    x: 22,
    y: 79,
    radius: 8,
    description:
      'Southern bastion city of the Western Reach. Primary hub for Forever Guild Halls and Chrono-crafting.',
  },
  {
    id: 'ashpeak-mountains',
    name: 'Ashpeak Mountains',
    continent: 'Central Caldera',
    levelRange: '45–58',
    x: 50,
    y: 33,
    radius: 11,
    description:
      'Volcanic highland surrounding the Cinder Maw. Rich in Obsidianite ore and Firewarden patrols.',
  },
  {
    id: 'cinder-maw',
    name: 'The Cinder Maw',
    continent: 'Central Caldera',
    levelRange: '58–60 (Raid)',
    x: 57,
    y: 51,
    radius: 10,
    description:
      'Molten heart of the Central Caldera housing the Eternal Forge and the 20-player Forever Raid.',
  },
  {
    id: 'whispering-woods',
    name: 'Whispering Woods',
    continent: 'Ebonis',
    levelRange: '30–45',
    x: 86,
    y: 23,
    radius: 10,
    description:
      'Misty eastern timberland where Echo Wraiths guard the Moonwell Relics.',
  },
  {
    id: 'ebonis',
    name: 'Ebonis',
    continent: 'Ebonis',
    levelRange: '50–60',
    x: 87,
    y: 48,
    radius: 11,
    description:
      'Obsidian citadel-province of the eastern continent. Features the Chrono-Auction House and Shadow Vault.',
  },
  {
    id: 'silvercliff',
    name: 'Silvercliff',
    continent: 'Ebonis',
    levelRange: '40–52',
    x: 85,
    y: 72,
    radius: 8,
    description:
      'Coastal port town connecting Ebonis to the Serpent’s Wake trade routes.',
  },
];

export const INITIAL_MAP_PINS: MapPin[] = [
  {
    id: 'pin-eternal-forge',
    x: 57,
    y: 51,
    title: 'Eternal Forge Entrance',
    note: 'Tier F1 crafting anvil & 20-player raid portal. Bring Fire-ward flasks.',
    category: 'boss',
    createdAt: Date.now() - 3600_000 * 5,
  },
  {
    id: 'pin-ley-nexus',
    x: 17,
    y: 52,
    title: 'Veridian Ley-Nexus',
    note: 'Daily Chronomancer questgiver & herb farm route.',
    category: 'quest',
    createdAt: Date.now() - 3600_000 * 14,
  },
];
