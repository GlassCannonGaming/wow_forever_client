import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  MapPin as MapPinIcon,
  Plus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { MapPin, MapRegion, PinCategory } from '../types';
import { computeMapCenterTransform } from '../utils/foreverDbParser';

export interface MapFocusTarget {
  regionId?: string;
  x: number;
  y: number;
  zoom?: number;
  timestamp: number;
}

interface WorldMapPanelProps {
  regions: MapRegion[];
  pins: MapPin[];
  highlightedRegionId: string | null;
  focusTarget?: MapFocusTarget | null;
  customMapUrl: string | null;
  onSelectRegion: (regionId: string | null) => void;
  onAddPin: (pin: Omit<MapPin, 'id' | 'createdAt'>) => void;
  onUpdatePin: (pin: MapPin) => void;
  onDeletePin: (pinId: string) => void;
  onChangeCustomMapUrl: (url: string | null) => void;
}

const DEFAULT_MAP_ASSET = '/src/assets/images/wow_forever_map_1794330599949.jpg';
const VISIBILITY_STORAGE_KEY = 'forever_atlas_map_visibility_v1';

export interface CategoryMeta {
  id: PinCategory;
  label: string;
  shortLabel: string;
  colorClass: string;
  dotColor: string;
}

export const PIN_CATEGORIES: CategoryMeta[] = [
  {
    id: 'quest',
    label: 'Quest Objective',
    shortLabel: 'Quests',
    colorClass: 'text-[#ffd100]',
    dotColor: 'bg-[#ffd100]',
  },
  {
    id: 'treasure',
    label: 'Treasure Chest / Coffer',
    shortLabel: 'Treasures',
    colorClass: 'text-[#ff8000]',
    dotColor: 'bg-[#ff8000]',
  },
  {
    id: 'rare',
    label: 'Rare Elite Spawn',
    shortLabel: 'Rares',
    colorClass: 'text-[#c655ff]',
    dotColor: 'bg-[#c655ff]',
  },
  {
    id: 'boss',
    label: 'Boss / Raid',
    shortLabel: 'Bosses',
    colorClass: 'text-[#ff4d4d]',
    dotColor: 'bg-[#ff4d4d]',
  },
  {
    id: 'resource',
    label: 'Resource Node',
    shortLabel: 'Resources',
    colorClass: 'text-[#1eff00]',
    dotColor: 'bg-[#1eff00]',
  },
  {
    id: 'custom',
    label: 'Custom Waypoint',
    shortLabel: 'Custom',
    colorClass: 'text-[#3b9eff]',
    dotColor: 'bg-[#3b9eff]',
  },
];

const DEFAULT_VISIBILITY: Record<PinCategory, boolean> = {
  quest: true,
  treasure: true,
  rare: true,
  boss: true,
  resource: true,
  custom: true,
};

function loadInitialVisibility(): Record<PinCategory, boolean> {
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBILITY;
    const parsed = JSON.parse(raw) as Partial<Record<PinCategory, boolean>>;
    return {
      ...DEFAULT_VISIBILITY,
      ...parsed,
    };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

export const WorldMapPanel: React.FC<WorldMapPanelProps> = ({
  regions,
  pins,
  highlightedRegionId,
  focusTarget,
  customMapUrl,
  onSelectRegion,
  onAddPin,
  onUpdatePin,
  onDeletePin,
  onChangeCustomMapUrl,
}) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [pinMode, setPinMode] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [visibleCategories, setVisibleCategories] =
    useState<Record<PinCategory, boolean>>(loadInitialVisibility);

  const [showCoordForm, setShowCoordForm] = useState(false);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [coordX, setCoordX] = useState<string>('57.0');
  const [coordY, setCoordY] = useState<string>('51.0');
  const [pinTitle, setPinTitle] = useState('');
  const [pinNote, setPinNote] = useState('');
  const [pinCategory, setPinCategory] = useState<PinCategory>('quest');

  const [showMapSourceModal, setShowMapSourceModal] = useState(false);
  const [mapUrlDraft, setMapUrlDraft] = useState(customMapUrl || '');

  const centerOnCoordinates = (xPct: number, yPct: number, targetZoom = 1.85) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const width = rect?.width || 720;
    const height = rect?.height || 405;
    const result = computeMapCenterTransform(xPct, yPct, width, height, targetZoom);
    setScale(result.scale);
    setOffset(result.offset);
    setCursorCoords({ x: xPct, y: yPct });
  };

  useEffect(() => {
    if (!focusTarget) return;
    centerOnCoordinates(focusTarget.x, focusTarget.y, focusTarget.zoom ?? 1.85);
  }, [focusTarget]);

  useEffect(() => {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibleCategories));
  }, [visibleCategories]);

  const activeRegion = regions.find((r) => r.id === highlightedRegionId) || null;
  const visiblePins = pins.filter((p) => visibleCategories[p.category] !== false);
  const allCategoriesVisible = PIN_CATEGORIES.every((c) => visibleCategories[c.id]);

  const toggleCategoryVisibility = (cat: PinCategory) => {
    setVisibleCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handleToggleAllCategories = () => {
    const nextState = !allCategoriesVisible;
    setVisibleCategories({
      quest: nextState,
      treasure: nextState,
      rare: nextState,
      boss: nextState,
      resource: nextState,
      custom: nextState,
    });
  };

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(2.8, Math.max(1, Number((prev + delta).toFixed(2)))));
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const computeRelativeCoords = (
    e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Number(Math.max(1, Math.min(99, rawX)).toFixed(1)),
      y: Number(Math.max(1, Math.min(99, rawY)).toFixed(1)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinMode) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const coords = computeRelativeCoords(e);
    setCursorCoords(coords);
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
    const coords = computeRelativeCoords(e);
    setEditingPinId(null);
    setCoordX(coords.x.toFixed(1));
    setCoordY(coords.y.toFixed(1));
    setPinTitle('');
    setPinNote('');
    setShowCoordForm(true);
  };

  const handleStartEditPin = (pin: MapPin) => {
    setEditingPinId(pin.id);
    setCoordX(pin.x.toFixed(1));
    setCoordY(pin.y.toFixed(1));
    setPinTitle(pin.title);
    setPinNote(pin.note);
    setPinCategory(pin.category);
    setShowCoordForm(true);
  };

  const handleOpenManualCoordEntry = () => {
    setEditingPinId(null);
    setCoordX(cursorCoords ? cursorCoords.x.toFixed(1) : '50.0');
    setCoordY(cursorCoords ? cursorCoords.y.toFixed(1) : '50.0');
    setPinTitle('');
    setPinNote('');
    setPinCategory('quest');
    setShowCoordForm(true);
  };

  const handleSavePinForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTitle.trim()) return;
    const parsedX = Number(Math.max(0, Math.min(100, parseFloat(coordX) || 50)).toFixed(1));
    const parsedY = Number(Math.max(0, Math.min(100, parseFloat(coordY) || 50)).toFixed(1));

    // Ensure the saved pin's category layer is visible so the user sees it immediately
    setVisibleCategories((prev) => ({ ...prev, [pinCategory]: true }));

    if (editingPinId) {
      const existing = pins.find((p) => p.id === editingPinId);
      if (existing) {
        onUpdatePin({
          ...existing,
          x: parsedX,
          y: parsedY,
          title: pinTitle.trim(),
          note: pinNote.trim() || 'Forever coordinate pin',
          category: pinCategory,
        });
      }
    } else {
      onAddPin({
        x: parsedX,
        y: parsedY,
        title: pinTitle.trim(),
        note: pinNote.trim() || 'Forever coordinate pin',
        category: pinCategory,
        zoneName: activeRegion?.name,
        buildVersion: '16001',
        provenance: 'Seen in Forever',
      });
    }

    setShowCoordForm(false);
    setEditingPinId(null);
    setPinTitle('');
    setPinNote('');
    setPinMode(false);
  };

  const handleMapFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChangeCustomMapUrl(reader.result);
        setMapUrlDraft(reader.result);
        setShowMapSourceModal(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Map Controls Header */}
      <div className="flex flex-col gap-3 wow-frame rounded-lg px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#ffd100] tracking-wide">
              World Map — Azeroth: Forever
            </h2>
            <p className="text-xs text-[#b8a382]">
              Click a zone to inspect · Toggle map tracking layers or mark waypoints by coordinates
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPinMode((v) => !v);
              }}
              className={`flex items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                pinMode ? 'wow-button-primary' : 'wow-button-secondary'
              }`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              {pinMode ? 'Click Map to Place Pin' : 'Drop Pin on Map'}
            </button>

            <button
              type="button"
              onClick={handleOpenManualCoordEntry}
              className="flex items-center gap-1.5 rounded wow-button-secondary px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
              Place by Coords
            </button>

            <button
              type="button"
              onClick={() => setShowMapSourceModal((v) => !v)}
              className="flex items-center gap-1.5 rounded wow-button-secondary px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
              Map Layer
            </button>

            <button
              type="button"
              onClick={() => handleZoom(0.3)}
              aria-label="Zoom in map"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded wow-button-secondary transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-0.3)}
              aria-label="Zoom out map"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded wow-button-secondary transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset map view"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded wow-button-secondary transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Category Pin Visibility Toggle Bar (WoW Map Tracking Filter) */}
        <div
          role="group"
          aria-label="Pin category visibility filters"
          className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#4a391f]"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {PIN_CATEGORIES.map((cat) => {
              const isVisible = visibleCategories[cat.id];
              const count = pins.filter((p) => p.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isVisible}
                  onClick={() => toggleCategoryVisibility(cat.id)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer border ${
                    isVisible
                      ? 'bg-[#261e14] border-[#8c6d3b] text-[#f3ead8] shadow-[inset_0_1px_0_rgba(255,215,110,0.18)]'
                      : 'bg-[#0c0a07] border-[#332716] text-[#6b5a42] opacity-65 hover:opacity-90'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 rounded-full ${
                      isVisible ? cat.dotColor : 'bg-[#4a391f]'
                    }`}
                  />
                  <span>{cat.shortLabel}</span>
                  <span className="font-mono-tabular text-[11px] text-[#b8a382]">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleToggleAllCategories}
            className="flex items-center gap-1.5 rounded wow-button-secondary px-2.5 py-1 text-xs font-medium cursor-pointer shrink-0"
          >
            {allCategoriesVisible ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hide All</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Show All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Map Layer Loader */}
      {showMapSourceModal && (
        <div className="rounded-lg wow-frame p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#ffd100]">
              Custom WoW: Forever Map Tile Layer
            </span>
            <button
              type="button"
              onClick={() => setShowMapSourceModal(false)}
              className="text-xs text-[#b8a382] hover:text-[#ffd100] cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-[#b8a382]">
            Upload an exported World of Warcraft: Forever map image or enter a URL. Coordinates (0.0–100.0) map automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={mapUrlDraft}
              onChange={(e) => setMapUrlDraft(e.target.value)}
              placeholder="Paste map image URL..."
              aria-label="Custom map image URL"
              className="flex-1 rounded wow-inset px-3 py-2 text-sm text-[#f3ead8]"
            />
            <label className="inline-flex items-center justify-center rounded wow-button-secondary px-3.5 py-2 text-xs font-medium cursor-pointer whitespace-nowrap">
              Upload Map Image
              <input
                type="file"
                accept="image/*"
                onChange={handleMapFileUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                onChangeCustomMapUrl(mapUrlDraft.trim() || null);
                setShowMapSourceModal(false);
              }}
              className="rounded wow-button-primary px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Apply Layer
            </button>
            {customMapUrl && (
              <button
                type="button"
                onClick={() => {
                  onChangeCustomMapUrl(null);
                  setMapUrlDraft('');
                  setShowMapSourceModal(false);
                }}
                className="rounded wow-button-secondary px-3 py-2 text-xs cursor-pointer whitespace-nowrap"
              >
                Reset Default
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scalable Map Viewport with Interactive Coordinate Overlay */}
      <div
        ref={viewportRef}
        data-testid="world-map-viewport"
        className={`relative w-full aspect-[16/9] overflow-hidden rounded-lg border-2 border-[#73582c] bg-[#080705] shadow-[0_10px_30px_rgba(0,0,0,0.8)] select-none ${
          pinMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          handlePointerUp();
          setCursorCoords(null);
        }}
        onWheel={(e) => {
          e.preventDefault();
          handleZoom(e.deltaY < 0 ? 0.15 : -0.15);
        }}
      >
        <div
          data-testid="world-map-canvas"
          className="relative w-full h-full transition-transform duration-300 ease-out origin-center"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          onClick={handleMapClick}
        >
          <img
            src={customMapUrl || DEFAULT_MAP_ASSET}
            alt="World of Warcraft: Forever Interactive World Map"
            referrerPolicy="no-referrer"
            draggable={false}
            className="w-full h-full object-cover"
          />

          {/* Subtle Coordinate Grid Overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,209,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,209,0,0.04)_1px,transparent_1px)] bg-[size:10%_10%]"
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
                  if (pinMode) {
                    setEditingPinId(null);
                    setCoordX(region.x.toFixed(1));
                    setCoordY(region.y.toFixed(1));
                    setPinTitle(`${region.name} Waypoint`);
                    setPinNote('');
                    setShowCoordForm(true);
                    return;
                  }
                  if (isHighlighted) {
                    onSelectRegion(null);
                    handleReset();
                  } else {
                    onSelectRegion(region.id);
                    centerOnCoordinates(region.x, region.y, 1.85);
                  }
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
                    ? 'bg-[#ffd100]/20 border-2 border-[#ffd100] shadow-[0_0_24px_rgba(255,209,0,0.55)]'
                    : 'bg-transparent border border-transparent hover:border-[#ffd100]/50 hover:bg-[#ffd100]/10'
                }`}
              />
            );
          })}

          {/* Saved Map Pins on Interactive Overlay */}
          {visiblePins.map((pin) => {
            const meta = PIN_CATEGORIES.find((c) => c.id === pin.category) || PIN_CATEGORIES[0];
            return (
              <button
                key={pin.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEditPin(pin);
                }}
                aria-label={`Pin ${pin.title} at (${pin.x.toFixed(1)}, ${pin.y.toFixed(1)})`}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-full group z-10 cursor-pointer focus:outline-none"
              >
                <div className="flex flex-col items-center">
                  <span className="px-2 py-0.5 mb-1 rounded bg-[#120f0b]/95 border border-[#8c6d3b] text-[11px] font-medium text-[#ffd100] whitespace-nowrap shadow group-hover:border-[#ffd100]">
                    {pin.title} · ({pin.x.toFixed(1)}, {pin.y.toFixed(1)})
                  </span>
                  <MapPinIcon
                    className={`w-5 h-5 drop-shadow transition-transform group-hover:scale-110 ${meta.colorClass}`}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Top-Left Live Coordinate HUD Overlay */}
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-3 rounded bg-[#120f0b]/90 border border-[#6e562f] px-3 py-1.5 text-xs font-mono-tabular text-[#f3ead8]">
          <span>
            Coords: {cursorCoords ? `${cursorCoords.x.toFixed(1)}, ${cursorCoords.y.toFixed(1)}` : '57.0, 51.0'}
          </span>
          <span aria-hidden="true" className="text-[#6e562f]">·</span>
          <span className="text-[#ffd100]">
            {pinMode ? 'Select Map Location' : `Showing ${visiblePins.length} of ${pins.length} Pins`}
          </span>
        </div>

        {/* Bottom-Right Scale Readout */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-[#120f0b]/90 border border-[#6e562f] px-2.5 py-1 text-xs font-mono-tabular text-[#ffd100]">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Coordinate Pin Placement & Editor Panel */}
      {showCoordForm && (
        <form
          onSubmit={handleSavePinForm}
          className="rounded-lg wow-frame p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#ffd100]">
              {editingPinId ? 'Edit Saved Coordinate Pin' : 'Place & Save Coordinate Pin'}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowCoordForm(false);
                setEditingPinId(null);
              }}
              className="text-xs text-[#b8a382] hover:text-[#ffd100] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div>
              <label htmlFor="pin-coord-x" className="block text-[11px] text-[#b8a382] mb-1">
                X Coord (0–100)
              </label>
              <input
                id="pin-coord-x"
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
                className="w-full rounded wow-inset px-3 py-2 text-sm font-mono-tabular text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
              />
            </div>

            <div>
              <label htmlFor="pin-coord-y" className="block text-[11px] text-[#b8a382] mb-1">
                Y Coord (0–100)
              </label>
              <input
                id="pin-coord-y"
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={coordY}
                onChange={(e) => setCoordY(e.target.value)}
                className="w-full rounded wow-inset px-3 py-2 text-sm font-mono-tabular text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="pin-label-input" className="block text-[11px] text-[#b8a382] mb-1">
                Pin Label
              </label>
              <input
                id="pin-label-input"
                type="text"
                required
                value={pinTitle}
                onChange={(e) => setPinTitle(e.target.value)}
                placeholder="e.g. Sunken Chrono-Coffer / Rare Spawn"
                className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] placeholder:text-[#78664c] focus:outline-none focus:border-[#c99e4c]"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="pin-category-select" className="block text-[11px] text-[#b8a382] mb-1">
                Category
              </label>
              <select
                id="pin-category-select"
                value={pinCategory}
                onChange={(e) => setPinCategory(e.target.value as PinCategory)}
                className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] focus:outline-none focus:border-[#c99e4c]"
              >
                {PIN_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label htmlFor="pin-note-input" className="block text-[11px] text-[#b8a382] mb-1">
                Tactical Notes / Respawn Timer
              </label>
              <input
                id="pin-note-input"
                type="text"
                value={pinNote}
                onChange={(e) => setPinNote(e.target.value)}
                placeholder="Notes, respawn timer, or required reagents..."
                className="w-full rounded wow-inset px-3 py-2 text-sm text-[#f3ead8] placeholder:text-[#78664c] focus:outline-none focus:border-[#c99e4c]"
              />
            </div>
            <button
              type="submit"
              className="rounded wow-button-primary px-5 py-2 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {editingPinId ? 'Update Pin' : 'Save Pin'}
            </button>
          </div>
        </form>
      )}

      {/* Region Inspector + Saved Pins List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg wow-frame p-4">
          <h3 className="text-sm font-bold text-[#ffd100] mb-2">Region Lore &amp; Level Range</h3>
          {activeRegion ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-[#fff3d1]">{activeRegion.name}</span>
                <span className="text-xs text-[#ffd100] font-mono-tabular">
                  Lvl {activeRegion.levelRange}
                </span>
              </div>
              <p className="text-xs text-[#b8a382] font-mono-tabular">
                {activeRegion.continent} · Coords ({activeRegion.x.toFixed(1)}, {activeRegion.y.toFixed(1)})
              </p>
              <p className="text-sm text-[#e6d5b8] leading-relaxed pt-1">
                {activeRegion.description}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#b8a382]">
              Select any territory on the World Map or ask the Chronicle Companion about a zone to inspect it.
            </p>
          )}
        </div>

        <div className="rounded-lg wow-frame p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-[#ffd100]">
              Visible Coordinate Pins ({visiblePins.length} / {pins.length})
            </h3>
            <span className="text-[11px] text-[#b8a382]">Saved to Local Tome</span>
          </div>
          {visiblePins.length === 0 ? (
            <p className="text-sm text-[#b8a382]">
              No pins visible for the selected category filters. Toggle categories above or place a new waypoint.
            </p>
          ) : (
            <ul className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {visiblePins.map((pin) => {
                const meta = PIN_CATEGORIES.find((c) => c.id === pin.category) || PIN_CATEGORIES[0];
                return (
                  <li
                    key={pin.id}
                    className="flex items-start justify-between gap-2 rounded wow-inset px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-[#f3ead8] font-medium">
                        <span className="truncate">{pin.title}</span>
                        <span className="text-[#6e562f] shrink-0">·</span>
                        <span className="font-mono-tabular text-[#ffd100] whitespace-nowrap shrink-0">
                          ({pin.x.toFixed(1)}, {pin.y.toFixed(1)})
                        </span>
                        <span className="text-[#6e562f] shrink-0">·</span>
                        <span className={`whitespace-nowrap shrink-0 ${meta.colorClass}`}>
                          {meta.shortLabel}
                        </span>
                      </div>
                      <p className="text-xs text-[#b8a382] truncate mt-0.5">{pin.note}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditPin(pin)}
                        aria-label={`Edit pin ${pin.title}`}
                        className="p-1.5 text-[#b8a382] hover:text-[#ffd100] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePin(pin.id)}
                        aria-label={`Delete pin ${pin.title}`}
                        className="p-1.5 text-[#b8a382] hover:text-[#ff4d4d] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
