import React, { useRef, useState } from 'react';
import { MapPin as MapPinIcon, Plus, RotateCcw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { MapPin, MapRegion } from '../types';

interface WorldMapPanelProps {
  regions: MapRegion[];
  pins: MapPin[];
  highlightedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
  onAddPin: (pin: Omit<MapPin, 'id' | 'createdAt'>) => void;
  onDeletePin: (pinId: string) => void;
}

export const WorldMapPanel: React.FC<WorldMapPanelProps> = ({
  regions,
  pins,
  highlightedRegionId,
  onSelectRegion,
  onAddPin,
  onDeletePin,
}) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [pinMode, setPinMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);
  const [pinTitle, setPinTitle] = useState('');
  const [pinNote, setPinNote] = useState('');
  const [pinCategory, setPinCategory] = useState<MapPin['category']>('custom');

  const activeRegion = regions.find((r) => r.id === highlightedRegionId) || null;

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(2.6, Math.max(1, Number((prev + delta).toFixed(2)))));
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinMode) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pinMode) return;
    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPendingCoords({ x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) });
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCoords || !pinTitle.trim()) return;
    onAddPin({
      x: pendingCoords.x,
      y: pendingCoords.y,
      title: pinTitle.trim(),
      note: pinNote.trim() || 'Custom Forever waypoint',
      category: pinCategory,
    });
    setPendingCoords(null);
    setPinTitle('');
    setPinNote('');
    setPinMode(false);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Azeroth: Forever Atlas</h2>
          <p className="text-xs text-slate-400">
            Scroll or use controls to scale · Click a region to inspect · Toggle Pin Mode to mark waypoints
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPinMode((v) => !v);
              setPendingCoords(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              pinMode
                ? 'bg-amber-600 text-slate-950'
                : 'border border-slate-700 bg-[#141720] text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {pinMode ? 'Click Map to Pin' : 'Drop Pin'}
          </button>

          <button
            type="button"
            onClick={() => handleZoom(0.3)}
            aria-label="Zoom in map"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-700 bg-[#141720] text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.3)}
            aria-label="Zoom out map"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-700 bg-[#141720] text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset map view"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-700 bg-[#141720] text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scalable Map Viewport */}
      <div
        data-testid="world-map-viewport"
        className={`relative w-full aspect-[16/9] overflow-hidden rounded-xl border border-slate-800 bg-[#090b10] select-none ${
          pinMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={(e) => {
          e.preventDefault();
          handleZoom(e.deltaY < 0 ? 0.15 : -0.15);
        }}
      >
        <div
          className="relative w-full h-full transition-transform duration-150 ease-out origin-center"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          onClick={handleMapClick}
        >
          <img
            src="/src/assets/images/wow_forever_map_1794330599949.jpg"
            alt="World of Warcraft: Forever Interactive World Map"
            referrerPolicy="no-referrer"
            draggable={false}
            className="w-full h-full object-cover"
          />

          {/* Region Highlight Overlays */}
          {regions.map((region) => {
            const isHighlighted = region.id === highlightedRegionId;
            return (
              <button
                key={region.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRegion(isHighlighted ? null : region.id);
                }}
                aria-label={`Inspect region ${region.name}`}
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.radius * 2}%`,
                  height: `${region.radius * 2}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all cursor-pointer ${
                  isHighlighted
                    ? 'bg-amber-500/25 border-2 border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.45)]'
                    : 'bg-transparent border border-transparent hover:border-amber-400/50 hover:bg-amber-500/10'
                }`}
              />
            );
          })}

          {/* Saved Map Pins */}
          {pins.map((pin) => (
            <div
              key={pin.id}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-full group z-10"
            >
              <div className="flex flex-col items-center">
                <span className="px-2 py-0.5 mb-1 rounded bg-[#0d0f14]/90 border border-amber-500/40 text-[11px] font-medium text-amber-200 whitespace-nowrap shadow">
                  {pin.title}
                </span>
                <MapPinIcon className="w-5 h-5 text-amber-400 drop-shadow" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>

        {/* Scale readout */}
        <div className="absolute bottom-3 right-3 rounded bg-[#0d0f14]/85 border border-slate-800 px-2.5 py-1 text-xs font-mono-tabular text-slate-300">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Pending Pin Form */}
      {pendingCoords && (
        <form
          onSubmit={handleSavePin}
          className="rounded-xl border border-amber-500/30 bg-[#141720] p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-200">
              New Pin at ({pendingCoords.x}, {pendingCoords.y})
            </span>
            <button
              type="button"
              onClick={() => setPendingCoords(null)}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={pinTitle}
              onChange={(e) => setPinTitle(e.target.value)}
              placeholder="Pin title (e.g. Rare Spawn)"
              className="rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={pinNote}
              onChange={(e) => setPinNote(e.target.value)}
              placeholder="Notes or mechanics..."
              className="rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <select
                value={pinCategory}
                onChange={(e) => setPinCategory(e.target.value as MapPin['category'])}
                aria-label="Pin category"
                className="flex-1 rounded-lg border border-slate-700 bg-[#0d0f14] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="custom">Custom</option>
                <option value="boss">Boss / Raid</option>
                <option value="quest">Quest</option>
                <option value="resource">Resource</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-500 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Region Inspector + Saved Pins List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#141720] p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Highlighted Region</h3>
          {activeRegion ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-amber-300">{activeRegion.name}</span>
                <span className="text-xs text-slate-400 font-mono-tabular">
                  Lvl {activeRegion.levelRange}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {activeRegion.continent} · Coords ({activeRegion.x}, {activeRegion.y})
              </p>
              <p className="text-sm text-slate-300 leading-relaxed pt-1">
                {activeRegion.description}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Click any region on the map or ask the Forever Companion about a zone to highlight it here.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#141720] p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">
            Saved Waypoints ({pins.length})
          </h3>
          {pins.length === 0 ? (
            <p className="text-sm text-slate-400">No pins saved yet. Use Drop Pin to mark locations.</p>
          ) : (
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {pins.map((pin) => (
                <li
                  key={pin.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#0d0f14] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
                      <span className="truncate">{pin.title}</span>
                      <span className="text-slate-500">·</span>
                      <span className="font-mono-tabular text-slate-400">
                        ({pin.x}, {pin.y})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{pin.note}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeletePin(pin.id)}
                    aria-label={`Delete pin ${pin.title}`}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
