import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemInstruction,
  DEFAULT_INSTRUCTION_CONFIG,
  DEFAULT_PLAYER_STATE,
  deriveAdaptiveDirectives,
  extractPlayerSummary,
  extractSpeechTranscript,
  filterRecentHistory,
  mergeDictatedInput,
  resolveSpeechRecognitionLang,
  shouldGenerateVisualAnswer,
  shouldRunBackgroundPatchSync,
} from './memory';
import {
  applyForeverDbPatches,
  comparePatchVersions,
  computeMapCenterTransform,
  parseForeverDataImport,
  parseTextWithLocationLinks,
  searchCodex,
} from './foreverDbParser';
import {
  BASE_FOREVERDB_VERSION,
  FOREVERDB_PATCH_DELTAS,
  INITIAL_GEAR_ITEMS,
  INITIAL_MAP_PINS,
  INITIAL_PROFESSION_RECIPES,
  WOW_FOREVER_REGIONS,
} from '../data/wowForeverData';
import type { ChatMessage } from '../types';

test('filterRecentHistory keeps only messages within 72 hours', () => {
  const now = 1_700_000_000_000;
  const hourMs = 60 * 60 * 1000;
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Old query', timestamp: now - 80 * hourMs },
    { id: '2', role: 'assistant', content: 'Recent reply', timestamp: now - 10 * hourMs },
    { id: '3', role: 'user', content: 'Boundary query', timestamp: now - 72 * hourMs },
  ];

  const recent = filterRecentHistory(messages, 72, now);
  assert.equal(recent.length, 2);
  assert.deepEqual(
    recent.map((m) => m.id),
    ['2', '3']
  );
});

test('extractPlayerSummary includes character location, level, gear, and recent queries', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Where is the Eternal Forge?', timestamp: 1000 },
  ];
  const summary = extractPlayerSummary(messages, DEFAULT_PLAYER_STATE);
  assert.match(summary, /Kaelen/);
  assert.match(summary, /Level 60/);
  assert.match(summary, /The Cinder Maw/);
  assert.match(summary, /Where is the Eternal Forge\?/);
});

test('buildSystemInstruction enforces Closed-World Build 16001 Grounding Lock and AI-adapted directives', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Where do I craft Obsidianite bars at the forge?', timestamp: Date.now() },
  ];
  const instruction = buildSystemInstruction(
    {
      ...DEFAULT_INSTRUCTION_CONFIG,
      voicePitch: 1.25,
      voiceRate: 1.15,
      voiceAccent: 'en-GB',
      responseStyle: 'tactical',
      closedWorldMode: true,
    },
    DEFAULT_PLAYER_STATE,
    messages
  );

  assert.match(instruction, /STRICT VERSION LOCK/);
  assert.match(instruction, /CLOSED-WORLD FOREVERDB \(BUILD 16001\) GROUNDING LOCK/);
  assert.match(instruction, /Imperial Ebonis \(British\)/);
  assert.match(instruction, /Pitch: 1\.25/);
  assert.match(instruction, /Speed: 1\.15x/);
  assert.match(instruction, /Structure answers like a veteran Raid Leader/);
  assert.match(instruction, /Emphasize tradeskill reagent quantities/);
  assert.match(instruction, /Last 72 Hours/);
});

test('deriveAdaptiveDirectives and shouldGenerateVisualAnswer adapt automatically to user choices and queries', () => {
  const directives = deriveAdaptiveDirectives(
    { ...DEFAULT_INSTRUCTION_CONFIG, responseStyle: 'lore-rich' },
    DEFAULT_PLAYER_STATE,
    [{ id: '1', role: 'user', content: 'Best raid boss tactic for Ignis?', timestamp: Date.now() }]
  );
  assert.match(directives, /Chronomancer Mage/);
  assert.match(directives, /Highlight boss phase transitions/);

  assert.equal(shouldGenerateVisualAnswer('Show me what The Cinder Maw looks like'), true);
  assert.equal(shouldGenerateVisualAnswer('Where is the Eternal Forge located on the map?'), true);
  assert.equal(shouldGenerateVisualAnswer('What is the cooldown on Chrono-Shift?'), false);
});

test('parseForeverDataImport enforces Build 16001 Provenance Gate and blocks legacy rows across JSON, Lua, and CSV', () => {
  const jsonPack = parseForeverDataImport(
    JSON.stringify({
      gear: [
        {
          id: 'g1',
          name: 'Crown of Ashpeak',
          slot: 'Head',
          quality: 'Epic',
          itemLevel: 78,
          requiredLevel: 60,
          build: '16001',
          provenance: 'Seen in Forever',
          stats: ['+32 Intellect'],
          source: 'Pyrelord Ignis',
          zone: 'The Cinder Maw',
        },
        {
          id: 'g-legacy',
          name: 'Contaminated Wrath Helm',
          slot: 'Head',
          quality: 'Epic',
          itemLevel: 200,
          requiredLevel: 80,
          build: '3.3.5',
          expansion: 'WotLK',
          source: '[WotLK] Icecrown',
        },
      ],
      recipes: [],
      pins: [{ x: 44.5, y: 61.2, title: 'Obsidian Vein', note: 'High yield', category: 'resource' }],
    })
  );

  assert.equal(jsonPack.gear.length, 1);
  assert.equal(jsonPack.gear[0].name, 'Crown of Ashpeak');
  assert.equal(jsonPack.gear[0].buildVersion, '16001');
  assert.equal(jsonPack.gear[0].provenance, 'Seen in Forever');
  assert.equal(jsonPack.rejectedLegacyCount, 1);

  const luaInput = `
    ForeverDB_Export = {
      ["gear"] = {
        {
          ["name"] = "Blade of Ebonis",
          ["slot"] = "Weapon",
          ["quality"] = "Legendary",
          ["itemLevel"] = 85,
          ["requiredLevel"] = 60,
          ["build"] = "16001",
          ["provenance"] = "Seen in Forever",
          ["source"] = "Shadow Vault",
          ["zone"] = "Ebonis",
        },
        {
          ["name"] = "Classic Thunderblade",
          ["slot"] = "Weapon",
          ["build"] = "1.12",
          ["expansion"] = "Classic",
        }
      }
    }
  `;
  const luaPack = parseForeverDataImport(luaInput);
  assert.equal(luaPack.gear.length, 1);
  assert.equal(luaPack.gear[0].name, 'Blade of Ebonis');
  assert.equal(luaPack.rejectedLegacyCount, 1);

  const csvInput = [
    'type,name,slot,quality,itemLevel,requiredLevel,build,provenance,source,zone',
    'gear,Girdle of the Cinder Maw,Chest,Epic,77,60,16001,Seen in Forever,Eternal Forge,The Cinder Maw',
    'gear,Retail Mythic Belt,Chest,Epic,489,70,10.2,Dragonflight,Vault,RetailZone',
  ].join('\n');
  const csvPack = parseForeverDataImport(csvInput);
  assert.equal(csvPack.gear.length, 1);
  assert.equal(csvPack.gear[0].name, 'Girdle of the Cinder Maw');
  assert.equal(csvPack.rejectedLegacyCount, 1);
});

test('searchCodex matches only Build 16001 gear and profession recipes by keywords', () => {
  const { matchedGear, matchedRecipes } = searchCodex(
    'obsidianite flask cinder',
    [
      {
        id: 'g1',
        name: 'Greaves of the Cinder Maw',
        slot: 'Legs',
        quality: 'Epic',
        itemLevel: 76,
        requiredLevel: 60,
        stats: ['+40 Stamina'],
        source: 'Cinder Maw Raid',
        zone: 'The Cinder Maw',
        buildVersion: '16001',
        provenance: 'Seen in Forever',
      },
    ],
    [
      {
        id: 'r1',
        name: 'Flask of Eternal Chrono-Ward',
        profession: 'Alchemy',
        skillRequired: 300,
        reagents: [{ name: 'Obsidianite Lotus', count: 2 }],
        effectOrStats: '+50 Fire and Arcane Resistance for 2 hrs',
        source: 'Veridian Sanctum Quartermaster',
        buildVersion: '16001',
        provenance: 'ForeverDB (16001)',
      },
    ]
  );

  assert.equal(matchedGear.length, 1);
  assert.equal(matchedRecipes.length, 1);
});

test('applyForeverDbPatches merges post-patch deltas onto the built-in client database and updates existing items', () => {
  assert.equal(comparePatchVersions('16001.4', '16001.6'), -1);
  assert.equal(comparePatchVersions('16001.6', '16001.6'), 0);

  const merged = applyForeverDbPatches(
    INITIAL_GEAR_ITEMS,
    INITIAL_PROFESSION_RECIPES,
    INITIAL_MAP_PINS,
    BASE_FOREVERDB_VERSION,
    FOREVERDB_PATCH_DELTAS
  );

  assert.equal(merged.latestVersion, '16001.6');
  assert.deepEqual(merged.appliedPatchVersions, ['16001.5', '16001.6']);
  assert.equal(merged.gear.length, 11);
  assert.equal(merged.recipes.length, 8);
  assert.equal(merged.pins.length, 8);

  // Verify Patch 16001.6 updated Mantle of the Eternal Forge from iLvl 78 to iLvl 80
  const mantle = merged.gear.find((g) => g.id === 'gear-mantle-eternal-forge');
  assert.ok(mantle);
  assert.equal(mantle.itemLevel, 80);
});

test('parseTextWithLocationLinks and computeMapCenterTransform extract clickable chat locations and center the map viewport', () => {
  const segments = parseTextWithLocationLinks(
    'Consult The Cinder Maw (57.0, 51.0) or travel east to Ebonis.',
    WOW_FOREVER_REGIONS
  );
  const locationSegments = segments.filter((s) => s.type === 'location');
  assert.equal(locationSegments.length, 2);
  assert.equal(locationSegments[0].regionId, 'cinder-maw');
  assert.equal(locationSegments[0].x, 57.0);
  assert.equal(locationSegments[0].y, 51.0);
  assert.equal(locationSegments[1].regionId, 'ebonis');

  // Center of map (50, 50) should have 0 offset
  const centerTransform = computeMapCenterTransform(50, 50, 800, 450, 1.85);
  assert.equal(centerTransform.scale, 1.85);
  assert.deepEqual(centerTransform.offset, { x: 0, y: 0 });

  //Veridian Wood (17, 52) is left of center (x < 50), so offset.x must be positive to shift left side toward center
  const veridianTransform = computeMapCenterTransform(17, 52, 800, 450, 1.85);
  assert.equal(veridianTransform.scale, 1.85);
  assert.ok(veridianTransform.offset.x > 0);
  assert.ok(veridianTransform.offset.y < 0);
});

test('shouldRunBackgroundPatchSync defaults to enabled and disables automatic patch fetches when toggled off', () => {
  assert.equal(DEFAULT_INSTRUCTION_CONFIG.backgroundPatchSync, true);
  assert.equal(shouldRunBackgroundPatchSync(DEFAULT_INSTRUCTION_CONFIG), true);
  assert.equal(
    shouldRunBackgroundPatchSync({
      ...DEFAULT_INSTRUCTION_CONFIG,
      backgroundPatchSync: false,
    }),
    false
  );
});

test('extractSpeechTranscript, mergeDictatedInput, and resolveSpeechRecognitionLang handle browser SpeechRecognition results', () => {
  assert.equal(resolveSpeechRecognitionLang('en-SCO'), 'en-GB');
  assert.equal(resolveSpeechRecognitionLang('en-IE'), 'en-IE');

  const parsed = extractSpeechTranscript([
    { isFinal: true, 0: { transcript: 'Where does Pyrelord Ignis' } },
    { isFinal: false, 0: { transcript: 'spawn in The Cinder Maw' } },
  ]);
  assert.equal(parsed.finalTranscript, 'Where does Pyrelord Ignis');
  assert.equal(parsed.interimTranscript, 'spawn in The Cinder Maw');
  assert.equal(parsed.combinedTranscript, 'Where does Pyrelord Ignis spawn in The Cinder Maw');

  assert.equal(
    mergeDictatedInput('Hello companion,', parsed.combinedTranscript),
    'Hello companion, Where does Pyrelord Ignis spawn in The Cinder Maw'
  );
  assert.equal(
    mergeDictatedInput('', parsed.combinedTranscript),
    'Where does Pyrelord Ignis spawn in The Cinder Maw'
  );
});




