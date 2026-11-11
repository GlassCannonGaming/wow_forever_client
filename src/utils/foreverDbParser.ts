import type {
  ForeverDbPatch,
  ForeverProvenance,
  GearItem,
  MapPin,
  MapRegion,
  ProfessionRecipe,
} from '../types';

export interface ForeverDataPack {
  gear: GearItem[];
  recipes: ProfessionRecipe[];
  pins: Omit<MapPin, 'id' | 'createdAt'>[];
  rejectedLegacyCount: number;
}

const BANNED_LEGACY_MARKERS = [
  'classic',
  'vanilla',
  '1.12',
  'tbc',
  'burning crusade',
  '2.4.3',
  'wotlk',
  'wrath',
  '3.3.5',
  'cataclysm',
  '4.3.4',
  'retail',
  'dragonflight',
  'war within',
  'shadowlands',
  '10.2',
  '11.0',
];

/**
 * Checks whether a raw record belongs exclusively to WoW: Forever (Build 16001)
 * and rejects rows tagged with legacy or retail expansion identifiers.
 */
export function isAuthenticForeverRecord(record: Record<string, unknown>): boolean {
  const buildVal = String(record.build ?? record.buildVersion ?? '16001').toLowerCase();
  const expansionVal = String(
    record.expansion ?? record.version ?? record.provenance ?? 'forever'
  ).toLowerCase();
  const sourceVal = String(record.source ?? '').toLowerCase();

  // If build is explicitly specified and not 16001 / forever, reject
  if (
    buildVal &&
    buildVal !== '16001' &&
    !buildVal.includes('forever') &&
    buildVal !== 'undefined'
  ) {
    return false;
  }

  // Reject if expansion/version/source explicitly flags a non-Forever version
  for (const banned of BANNED_LEGACY_MARKERS) {
    if (expansionVal.includes(banned) || sourceVal.includes(`[${banned}]`)) {
      return false;
    }
  }

  return true;
}

function resolveProvenance(record: Record<string, unknown>): ForeverProvenance {
  const raw = String(record.provenance ?? record.status ?? '').toLowerCase();
  if (raw.includes('seen') || record.verified === true) {
    return 'Seen in Forever';
  }
  return 'ForeverDB (16001)';
}

/**
 * Converts a Lua table expression (from WoW Forever SavedVariables or ForeverDB) into valid JSON text.
 */
function luaTableToJson(luaText: string): string {
  let s = luaText.trim();
  s = s.replace(/--.*$/gm, '');
  const firstBrace = s.indexOf('{');
  if (firstBrace !== -1 && s.slice(0, firstBrace).includes('=')) {
    s = s.slice(firstBrace);
  }
  s = s.replace(/;\s*$/, '');
  s = s.replace(/\[\s*"([^"]+)"\s*\]\s*=/g, '"$1":');
  s = s.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g, '"$1":');
  s = s.replace(/,\s*\}/g, '}');

  let changed = true;
  let safety = 0;
  while (changed && safety < 20) {
    changed = false;
    safety++;
    const next1 = s.replace(/\{([^{}:]*)\}/g, (_match, inner: string) => {
      changed = true;
      return `[${inner}]`;
    });
    s = next1;

    const next2 = s.replace(
      /\{\s*((?:\{[^{}]*\}|\[[^[\]]*\])(?:\s*,\s*(?:\{[^{}]*\}|\[[^[\]]*\]))*)\s*\}/g,
      (_match, inner: string) => {
        changed = true;
        return `[${inner}]`;
      }
    );
    s = next2;
  }

  s = s.replace(/,\s*([}\]])/g, '$1');
  return s;
}

/**
 * Parses DB2 CSV exports (e.g., ItemSparse.csv or SkillLineAbility.csv with header row)
 * and filters them through the Build 16001 Provenance Gate.
 */
function parseDb2Csv(csvText: string): ForeverDataPack {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rawGear: Record<string, unknown>[] = [];
  const rawRecipes: Record<string, unknown>[] = [];
  const rawPins: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });

    const recordType = String(row.type ?? row.categoryType ?? 'gear').toLowerCase();
    if (recordType === 'recipe' || row.profession) {
      rawRecipes.push({
        ...row,
        reagents:
          typeof row.reagents === 'string' && row.reagents
            ? row.reagents.split(';').map((part) => {
                const [cnt, ...rest] = part.trim().split('x ');
                return {
                  name: rest.join('x ') || part.trim(),
                  count: Number(cnt) || 1,
                };
              })
            : undefined,
      });
    } else if (recordType === 'pin' || (row.x !== undefined && row.y !== undefined && row.title)) {
      rawPins.push(row);
    } else {
      rawGear.push({
        ...row,
        stats:
          typeof row.stats === 'string' && row.stats
            ? row.stats.split(';').map((s) => s.trim())
            : ['+30 Chrono Power'],
      });
    }
  }

  return normalizeDataPack({ gear: rawGear, recipes: rawRecipes, pins: rawPins });
}

/**
 * Parses ForeverDB JSON, SavedVariables Lua (`ForeverDB_Export = { ... }`), or DB2 CSV exports,
 * enforcing the Build 16001 Provenance Gate to reject any non-Forever data.
 */
export function parseForeverDataImport(rawInput: string): ForeverDataPack {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Import payload cannot be empty.');
  }

  // Case 1: Standard JSON payload
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeDataPack(parsed);
    } catch (err) {
      throw new Error(
        `Invalid JSON format: ${err instanceof Error ? err.message : 'parse error'}`
      );
    }
  }

  // Case 2: WoW Forever SavedVariables Lua table (`ForeverDB_Export = { ... }`)
  if (trimmed.includes('=') && trimmed.includes('{')) {
    try {
      const jsonStr = luaTableToJson(trimmed);
      const parsed = JSON.parse(jsonStr);
      return normalizeDataPack(parsed);
    } catch {
      throw new Error(
        'Could not parse SavedVariables Lua table. Ensure keys and strings use double quotes or valid ForeverDB export syntax.'
      );
    }
  }

  // Case 3: DB2 CSV table export (header + comma-separated rows)
  if (trimmed.includes(',') && trimmed.includes('\n')) {
    return parseDb2Csv(trimmed);
  }

  throw new Error(
    'Unrecognized format. Provide a ForeverDB JSON pack, SavedVariables .lua table, or DB2 .csv export.'
  );
}

function normalizeDataPack(raw: unknown): ForeverDataPack {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const rawGear = Array.isArray(obj.gear) ? obj.gear : [];
  const rawRecipes = Array.isArray(obj.recipes) ? obj.recipes : [];
  const rawPins = Array.isArray(obj.pins) ? obj.pins : [];

  let rejectedLegacyCount = 0;

  const gear: GearItem[] = [];
  rawGear.forEach((g, idx) => {
    if (typeof g !== 'object' || g === null || typeof (g as Record<string, unknown>).name !== 'string') {
      return;
    }
    const rec = g as Record<string, unknown>;
    if (!isAuthenticForeverRecord(rec)) {
      rejectedLegacyCount++;
      return;
    }
    gear.push({
      id: typeof rec.id === 'string' && rec.id ? rec.id : `imported-gear-${Date.now()}-${idx}`,
      name: String(rec.name),
      slot: (rec.slot as GearItem['slot']) || 'Weapon',
      quality: (rec.quality as GearItem['quality']) || 'Epic',
      itemLevel: Number(rec.itemLevel) || 60,
      requiredLevel: Number(rec.requiredLevel) || 60,
      stats: Array.isArray(rec.stats) ? rec.stats.map(String) : ['+25 Chrono Power'],
      source: typeof rec.source === 'string' && rec.source ? rec.source : 'ForeverDB (16001)',
      zone: typeof rec.zone === 'string' && rec.zone ? rec.zone : 'The Cinder Maw',
      coords:
        rec.x !== undefined && rec.y !== undefined
          ? { x: Number(rec.x), y: Number(rec.y) }
          : undefined,
      buildVersion: '16001',
      provenance: resolveProvenance(rec),
    });
  });

  const recipes: ProfessionRecipe[] = [];
  rawRecipes.forEach((r, idx) => {
    if (typeof r !== 'object' || r === null || typeof (r as Record<string, unknown>).name !== 'string') {
      return;
    }
    const rec = r as Record<string, unknown>;
    if (!isAuthenticForeverRecord(rec)) {
      rejectedLegacyCount++;
      return;
    }
    recipes.push({
      id: typeof rec.id === 'string' && rec.id ? rec.id : `imported-recipe-${Date.now()}-${idx}`,
      name: String(rec.name),
      profession: (rec.profession as ProfessionRecipe['profession']) || 'Blacksmithing',
      skillRequired: Number(rec.skillRequired) || 300,
      reagents: Array.isArray(rec.reagents)
        ? rec.reagents.map((rg: Record<string, unknown>) => ({
            name: String(rg.name || 'Obsidianite Bar'),
            count: Number(rg.count) || 1,
          }))
        : [{ name: 'Obsidianite Bar', count: 4 }],
      effectOrStats:
        typeof rec.effectOrStats === 'string' && rec.effectOrStats
          ? rec.effectOrStats
          : 'Crafts Forever Tier Equipment',
      source: typeof rec.source === 'string' && rec.source ? rec.source : 'ForeverDB (16001)',
      cooldown: typeof rec.cooldown === 'string' ? rec.cooldown : undefined,
      buildVersion: '16001',
      provenance: resolveProvenance(rec),
    });
  });

  const pins: Omit<MapPin, 'id' | 'createdAt'>[] = [];
  rawPins.forEach((p) => {
    if (typeof p !== 'object' || p === null || typeof (p as Record<string, unknown>).title !== 'string') {
      return;
    }
    const rec = p as Record<string, unknown>;
    if (!isAuthenticForeverRecord(rec)) {
      rejectedLegacyCount++;
      return;
    }
    pins.push({
      x: Math.max(0, Math.min(100, Number(rec.x) || 50)),
      y: Math.max(0, Math.min(100, Number(rec.y) || 50)),
      title: String(rec.title),
      note: typeof rec.note === 'string' ? rec.note : 'Imported ForeverDB coordinate',
      category: (rec.category as MapPin['category']) || 'custom',
      zoneName: typeof rec.zoneName === 'string' ? rec.zoneName : undefined,
      buildVersion: '16001',
      provenance: resolveProvenance(rec),
    });
  });

  return { gear, recipes, pins, rejectedLegacyCount };
}

/**
 * Searches verified Build 16001 Gear and Profession Recipes matching a user query or keyword.
 */
export function searchCodex(
  query: string,
  gear: GearItem[],
  recipes: ProfessionRecipe[]
): { matchedGear: GearItem[]; matchedRecipes: ProfessionRecipe[] } {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

  if (tokens.length === 0) {
    return { matchedGear: [], matchedRecipes: [] };
  }

  const matchedGear = gear.filter((item) => {
    if (item.buildVersion !== '16001') return false;
    const haystack = `${item.name} ${item.slot} ${item.quality} ${item.source} ${item.zone} ${item.stats.join(' ')}`.toLowerCase();
    return tokens.some((tk) => haystack.includes(tk));
  });

  const matchedRecipes = recipes.filter((rec) => {
    if (rec.buildVersion !== '16001') return false;
    const reagentNames = rec.reagents.map((r) => r.name).join(' ');
    const haystack = `${rec.name} ${rec.profession} ${rec.effectOrStats} ${rec.source} ${reagentNames}`.toLowerCase();
    return tokens.some((tk) => haystack.includes(tk));
  });

  return {
    matchedGear: matchedGear.slice(0, 6),
    matchedRecipes: matchedRecipes.slice(0, 6),
  };
}

/**
 * Compares two ForeverDB patch version strings (e.g., "16001.4" vs "16001.6").
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
export function comparePatchVersions(a: string, b: string): number {
  const partsA = a.split('.').map((n) => parseInt(n, 10) || 0);
  const partsB = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA < valB) return -1;
    if (valA > valB) return 1;
  }
  return 0;
}

/**
 * Applies verified Build 16001 ForeverDB patch deltas onto the client's built-in database.
 * Existing items/recipes with matching IDs are updated in place (for balance tuning),
 * while new items, recipes, and map pins are merged automatically.
 */
export function applyForeverDbPatches(
  currentGear: GearItem[],
  currentRecipes: ProfessionRecipe[],
  currentPins: MapPin[],
  currentVersion: string,
  patches: ForeverDbPatch[]
): {
  gear: GearItem[];
  recipes: ProfessionRecipe[];
  pins: MapPin[];
  latestVersion: string;
  appliedPatchVersions: string[];
  updatedCount: number;
} {
  const sortedPatches = [...patches].sort((p1, p2) =>
    comparePatchVersions(p1.patchVersion, p2.patchVersion)
  );

  const gearMap = new Map<string, GearItem>();
  currentGear.forEach((g) => gearMap.set(g.id, g));

  const recipeMap = new Map<string, ProfessionRecipe>();
  currentRecipes.forEach((r) => recipeMap.set(r.id, r));

  const nextPins = [...currentPins];
  let latestVersion = currentVersion;
  const appliedPatchVersions: string[] = [];
  let updatedCount = 0;

  for (const patch of sortedPatches) {
    if (patch.buildVersion !== '16001') continue;
    if (comparePatchVersions(patch.patchVersion, currentVersion) <= 0) {
      continue;
    }

    for (const item of patch.gear) {
      if (!isAuthenticForeverRecord(item as unknown as Record<string, unknown>)) continue;
      gearMap.set(item.id, { ...item, buildVersion: '16001' });
      updatedCount++;
    }

    for (const rec of patch.recipes) {
      if (!isAuthenticForeverRecord(rec as unknown as Record<string, unknown>)) continue;
      recipeMap.set(rec.id, { ...rec, buildVersion: '16001' });
      updatedCount++;
    }

    for (const pin of patch.pins) {
      if (!isAuthenticForeverRecord(pin as unknown as Record<string, unknown>)) continue;
      const alreadyExists = nextPins.some(
        (existing) =>
          existing.title.toLowerCase() === pin.title.toLowerCase() &&
          Math.abs(existing.x - pin.x) < 0.2 &&
          Math.abs(existing.y - pin.y) < 0.2
      );
      if (!alreadyExists) {
        nextPins.unshift({
          ...pin,
          id: `patch-pin-${patch.patchVersion}-${pin.title.replace(/\s+/g, '-').toLowerCase()}`,
          buildVersion: '16001',
          createdAt: Date.now(),
        });
        updatedCount++;
      }
    }

    appliedPatchVersions.push(patch.patchVersion);
    if (comparePatchVersions(patch.patchVersion, latestVersion) > 0) {
      latestVersion = patch.patchVersion;
    }
  }

  return {
    gear: Array.from(gearMap.values()),
    recipes: Array.from(recipeMap.values()),
    pins: nextPins,
    latestVersion,
    appliedPatchVersions,
    updatedCount,
  };
}

/**
 * Computes the clamped scale and (x, y) pixel translation to center the map viewport
 * on a target percentage coordinate (xPct, yPct) without exposing empty edges.
 */
export function computeMapCenterTransform(
  xPct: number,
  yPct: number,
  viewportWidth: number,
  viewportHeight: number,
  targetScale = 1.85
): { scale: number; offset: { x: number; y: number } } {
  const clampedScale = Math.min(2.8, Math.max(1, Number(targetScale.toFixed(2))));
  const w = Math.max(1, viewportWidth);
  const h = Math.max(1, viewportHeight);

  const rawX = -((xPct - 50) / 100) * w * clampedScale;
  const rawY = -((yPct - 50) / 100) * h * clampedScale;

  const maxOffsetX = ((clampedScale - 1) * w) / 2;
  const maxOffsetY = ((clampedScale - 1) * h) / 2;

  const clampedX = Math.round(Math.max(-maxOffsetX, Math.min(maxOffsetX, rawX)));
  const clampedY = Math.round(Math.max(-maxOffsetY, Math.min(maxOffsetY, rawY)));

  return {
    scale: clampedScale,
    offset: {
      x: Object.is(clampedX, -0) ? 0 : clampedX,
      y: Object.is(clampedY, -0) ? 0 : clampedY,
    },
  };
}

export interface TextLocationSegment {
  type: 'text' | 'location';
  text: string;
  regionId?: string;
  regionName?: string;
  x?: number;
  y?: number;
}

/**
 * Splits chat message text into plain text segments and clickable location/coordinate links
 * matched against World of Warcraft: Forever regions or (X, Y) coordinate pairs.
 */
export function parseTextWithLocationLinks(
  content: string,
  regions: MapRegion[]
): TextLocationSegment[] {
  if (!content) return [];

  const escapedNames = [...regions]
    .sort((a, b) => b.name.length - a.name.length)
    .map((r) => r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  // Match either a known WoW: Forever region name (optionally followed by " (X, Y)") or a standalone "(X.X, Y.Y)" coordinate pair
  const pattern = new RegExp(
    `(${escapedNames.join('|')})(?:\\s*\\((\\d{1,2}(?:\\.\\d+)?)\\s*,\\s*(\\d{1,2}(?:\\.\\d+)?)\\))?|\\((\\d{1,2}(?:\\.\\d+)?)\\s*,\\s*(\\d{1,2}(?:\\.\\d+)?)\\)`,
    'gi'
  );

  const segments: TextLocationSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: content.slice(lastIndex, match.index),
      });
    }

    const matchedRegionName = match[1];
    if (matchedRegionName) {
      const region = regions.find(
        (r) => r.name.toLowerCase() === matchedRegionName.toLowerCase()
      );
      if (region) {
        const coordX = match[2] !== undefined ? parseFloat(match[2]) : region.x;
        const coordY = match[3] !== undefined ? parseFloat(match[3]) : region.y;
        segments.push({
          type: 'location',
          text: match[0],
          regionId: region.id,
          regionName: region.name,
          x: coordX,
          y: coordY,
        });
      } else {
        segments.push({ type: 'text', text: match[0] });
      }
    } else if (match[4] !== undefined && match[5] !== undefined) {
      const coordX = parseFloat(match[4]);
      const coordY = parseFloat(match[5]);
      // Find closest region to associate if within range
      let closestRegion: MapRegion | undefined;
      let minDist = Infinity;
      for (const r of regions) {
        const dist = Math.hypot(r.x - coordX, r.y - coordY);
        if (dist < minDist && dist <= 18) {
          minDist = dist;
          closestRegion = r;
        }
      }
      segments.push({
        type: 'location',
        text: match[0],
        regionId: closestRegion?.id,
        regionName: closestRegion?.name,
        x: coordX,
        y: coordY,
      });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      text: content.slice(lastIndex),
    });
  }

  return segments;
}


