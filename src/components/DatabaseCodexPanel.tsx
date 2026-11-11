import React, { useState } from 'react';
import {
  CheckCircle2,
  Hammer,
  MapPin as MapPinIcon,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
} from 'lucide-react';
import type {
  ForeverDbPatch,
  ForeverDbSyncState,
  GearItem,
  MapPin,
  ProfessionRecipe,
} from '../types';
import { FOREVERDB_PATCH_DELTAS } from '../data/wowForeverData';

interface DatabaseCodexPanelProps {
  gear: GearItem[];
  recipes: ProfessionRecipe[];
  syncState: ForeverDbSyncState;
  onCheckForPatches: () => void;
  onPinItemSource: (pin: Omit<MapPin, 'id' | 'createdAt'>) => void;
}

type SubView = 'gear' | 'professions' | 'patches';

export const DatabaseCodexPanel: React.FC<DatabaseCodexPanelProps> = ({
  gear,
  recipes,
  syncState,
  onCheckForPatches,
  onPinItemSource,
}) => {
  const [subView, setSubView] = useState<SubView>('gear');
  const [searchQuery, setSearchQuery] = useState('');
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [professionFilter, setProfessionFilter] = useState<string>('all');

  const filteredGear = gear.filter((item) => {
    const matchesSlot = slotFilter === 'all' || item.slot === slotFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesText =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.zone.toLowerCase().includes(q) ||
      item.stats.some((s) => s.toLowerCase().includes(q));
    return matchesSlot && matchesText;
  });

  const filteredRecipes = recipes.filter((rec) => {
    const matchesProf = professionFilter === 'all' || rec.profession === professionFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesText =
      !q ||
      rec.name.toLowerCase().includes(q) ||
      rec.effectOrStats.toLowerCase().includes(q) ||
      rec.source.toLowerCase().includes(q) ||
      rec.reagents.some((r) => r.name.toLowerCase().includes(q));
    return matchesProf && matchesText;
  });

  const patchesNewestFirst: ForeverDbPatch[] = [...FOREVERDB_PATCH_DELTAS].reverse();

  return (
    <div className="space-y-5">
      {/* Header & Sub-Navigation */}
      <div className="rounded-lg wow-frame p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-bold text-[#ffd100] tracking-wide">
              Adventure Guide &amp; ForeverDB Codex
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded wow-inset px-2.5 py-0.5 text-[11px] font-mono-tabular text-[#1eff00]">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              <span>ForeverDB Build {syncState.currentPatchVersion} · Built-In</span>
            </span>
          </div>
          <p className="text-xs text-[#b8a382]">
            Pre-loaded World of Warcraft: Forever Armory &amp; Tradeskills · Automatically updates after game patches
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded wow-inset p-1">
            <button
              type="button"
              onClick={() => setSubView('gear')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                subView === 'gear'
                  ? 'wow-button-primary font-semibold'
                  : 'text-[#c9b38c] hover:text-[#ffd100]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Gear Search ({gear.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('professions')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                subView === 'professions'
                  ? 'wow-button-primary font-semibold'
                  : 'text-[#c9b38c] hover:text-[#ffd100]'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Professions ({recipes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('patches')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                subView === 'patches'
                  ? 'wow-button-primary font-semibold'
                  : 'text-[#c9b38c] hover:text-[#ffd100]'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Patch Updates ({FOREVERDB_PATCH_DELTAS.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onCheckForPatches}
            disabled={syncState.status === 'checking'}
            className="flex items-center gap-1.5 rounded wow-button-secondary px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            title="Check server manifest for post-patch ForeverDB updates"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncState.status === 'checking' ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>
              {syncState.status === 'checking' ? 'Checking Patch...' : 'Sync Patch Data'}
            </span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar for Gear / Professions */}
      {subView !== 'patches' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-[#857256] absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                subView === 'gear'
                  ? 'Search Forever gear by name, stat, boss, or zone...'
                  : 'Search Forever recipes by name, reagent, or effect...'
              }
              aria-label="Search ForeverDB Codex"
              className="w-full min-h-[42px] rounded wow-inset pl-10 pr-4 py-2 text-sm text-[#f3ead8] placeholder:text-[#78664c] focus:outline-none focus:border-[#c99e4c]"
            />
          </div>

          {subView === 'gear' ? (
            <select
              value={slotFilter}
              onChange={(e) => setSlotFilter(e.target.value)}
              aria-label="Filter by equipment slot"
              className="min-h-[42px] rounded wow-inset px-3.5 py-2 text-sm text-[#e6d5b8] focus:outline-none focus:border-[#c99e4c]"
            >
              <option value="all">All Equipment Slots</option>
              <option value="Weapon">Weapon</option>
              <option value="Head">Head</option>
              <option value="Shoulder">Shoulder</option>
              <option value="Chest">Chest</option>
              <option value="Hands">Hands</option>
              <option value="Legs">Legs</option>
              <option value="Ring">Ring</option>
              <option value="Trinket">Trinket</option>
            </select>
          ) : (
            <select
              value={professionFilter}
              onChange={(e) => setProfessionFilter(e.target.value)}
              aria-label="Filter by profession"
              className="min-h-[42px] rounded wow-inset px-3.5 py-2 text-sm text-[#e6d5b8] focus:outline-none focus:border-[#c99e4c]"
            >
              <option value="all">All Tradeskill Professions</option>
              <option value="Blacksmithing">Blacksmithing</option>
              <option value="Alchemy">Alchemy</option>
              <option value="Enchanting">Enchanting</option>
              <option value="Tailoring">Tailoring</option>
              <option value="Jewelcrafting">Jewelcrafting</option>
              <option value="Engineering">Engineering</option>
            </select>
          )}
        </div>
      )}

      {/* VIEW 1: Gear Search (WoW Tooltip Style) */}
      {subView === 'gear' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGear.length === 0 ? (
            <div className="col-span-2 rounded-lg wow-frame p-8 text-center text-sm text-[#b8a382]">
              No Forever gear items match your filter.
            </div>
          ) : (
            filteredGear.map((item) => {
              const qualityColor =
                item.quality === 'Legendary'
                  ? 'text-[#ff8000]'
                  : item.quality === 'Epic'
                  ? 'text-[#c655ff]'
                  : item.quality === 'Rare'
                  ? 'text-[#3b9eff]'
                  : 'text-[#1eff00]';

              return (
                <div
                  key={item.id}
                  className="rounded-lg wow-frame p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-base font-bold ${qualityColor}`}>{item.name}</h3>
                      <span className="text-xs font-mono-tabular text-[#ffd100] shrink-0">
                        Item Level {item.itemLevel}
                      </span>
                    </div>
                    <p className="text-xs text-[#b8a382]">
                      {item.quality} · {item.slot} · Requires Level {item.requiredLevel}
                    </p>
                    <ul className="space-y-0.5 pt-1">
                      {item.stats.map((st, i) => (
                        <li
                          key={i}
                          className={`text-xs font-mono-tabular ${
                            st.startsWith('Equip:') || st.startsWith('Use:')
                              ? 'text-[#1eff00]'
                              : 'text-[#ffffff]'
                          }`}
                        >
                          {st}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-[#4a391f] flex items-center justify-between gap-2">
                    <span className="text-xs text-[#b8a382] truncate">
                      Source: {item.source} ({item.zone})
                    </span>
                    {item.coords && (
                      <button
                        type="button"
                        onClick={() =>
                          onPinItemSource({
                            x: item.coords!.x,
                            y: item.coords!.y,
                            title: item.name,
                            note: `Drop source: ${item.source} (${item.zone})`,
                            category: 'boss',
                            zoneName: item.zone,
                            buildVersion: '16001',
                            provenance: item.provenance,
                          })
                        }
                        className="flex items-center gap-1 rounded wow-button-secondary px-2.5 py-1 text-xs cursor-pointer shrink-0"
                      >
                        <MapPinIcon className="w-3 h-3" aria-hidden="true" />
                        <span>Pin ({item.coords.x.toFixed(1)}, {item.coords.y.toFixed(1)})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: Tradeskill Profession Recipes */}
      {subView === 'professions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecipes.length === 0 ? (
            <div className="col-span-2 rounded-lg wow-frame p-8 text-center text-sm text-[#b8a382]">
              No Forever profession recipes match your filter.
            </div>
          ) : (
            filteredRecipes.map((rec) => (
              <div
                key={rec.id}
                className="rounded-lg wow-frame p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[#ffd100]">{rec.name}</h3>
                    <span className="text-xs font-mono-tabular text-[#b8a382] shrink-0">
                      {rec.profession} ({rec.skillRequired})
                    </span>
                  </div>
                  <p className="text-xs text-[#1eff00] leading-relaxed">{rec.effectOrStats}</p>
                  <div className="pt-1">
                    <span className="block text-[11px] text-[#b8a382] mb-1">Reagents:</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono-tabular text-[#f3ead8]">
                      {rec.reagents.map((rg, i) => (
                        <span key={i}>
                          {rg.count}x {rg.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#4a391f] flex items-center justify-between text-xs text-[#b8a382]">
                  <span className="truncate">{rec.source}</span>
                  {rec.cooldown && (
                    <span className="font-mono-tabular text-[#ffd100] shrink-0">{rec.cooldown}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VIEW 3: Built-In ForeverDB Patch History & Delta Manifest */}
      {subView === 'patches' && (
        <div className="space-y-4">
          <div className="rounded-lg wow-frame p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#ffd100]">
                Built-In ForeverDB Client Registry · Build {syncState.currentPatchVersion}
              </h3>
              <p className="text-xs text-[#b8a382] mt-0.5">
                All World of Warcraft: Forever items, tradeskill recipes, and map coordinates are pre-indexed in the client and automatically patched upon realm updates.
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-[#1eff00] shrink-0">
              Last Verified:{' '}
              {new Date(syncState.lastCheckedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {patchesNewestFirst.map((patch) => {
            const isApplied = syncState.appliedPatches.includes(patch.patchVersion);
            return (
              <div key={patch.patchVersion} className="rounded-lg wow-frame p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4a391f] pb-2.5">
                  <div>
                    <h4 className="text-base font-bold text-[#ffd100]">{patch.title}</h4>
                    <p className="text-xs text-[#b8a382]">
                      Released {patch.releasedAt} · {patch.gear.length} Gear Record(s) ·{' '}
                      {patch.recipes.length} Recipe(s) · {patch.pins.length} Map Waypoint(s)
                    </p>
                  </div>
                  <span className="rounded wow-inset px-2.5 py-1 text-xs font-mono-tabular text-[#1eff00]">
                    {isApplied ? `Applied (${patch.patchVersion})` : `Merged (${patch.patchVersion})`}
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs text-[#e6d5b8] list-disc list-inside">
                  {patch.notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
