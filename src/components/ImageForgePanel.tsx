import React, { useState } from 'react';
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';

export interface GeneratedAsset {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

interface ImageForgePanelProps {
  assets: GeneratedAsset[];
  onAddAsset: (asset: GeneratedAsset) => void;
}

export const ImageForgePanel: React.FC<ImageForgePanelProps> = ({ assets, onAddAsset }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Failed to generate image.');
      }
      onAddAsset({
        id: `img-${Date.now()}`,
        prompt: prompt.trim(),
        imageUrl: data.imageUrl,
        createdAt: Date.now(),
      });
      setPrompt('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-slate-800 bg-[#141720] p-5">
        <h2 className="text-lg font-semibold text-slate-100">Forever Image Forge</h2>
        <p className="text-xs text-slate-400 mt-1">
          Generate World of Warcraft: Forever zone concepts, raid bosses, or Tier F1 gear visuals.
        </p>

        <form onSubmit={handleGenerate} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a WoW Forever scene, boss, or weapon..."
            aria-label="Image generation prompt"
            className="flex-1 min-h-[44px] rounded-lg border border-slate-700 bg-[#0d0f14] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="min-h-[44px] px-5 rounded-lg bg-amber-600 text-slate-950 font-semibold text-sm hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isGenerating ? 'Forging...' : 'Generate Image'}</span>
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#141720] p-10 text-center">
          <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-slate-400">
            No generated visuals yet. Enter a prompt above to forge WoW Forever artwork.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-slate-800 bg-[#141720] overflow-hidden"
            >
              <img
                src={asset.imageUrl}
                alt={asset.prompt}
                referrerPolicy="no-referrer"
                className="w-full aspect-video object-cover bg-[#090b10]"
              />
              <div className="p-3.5">
                <p className="text-sm text-slate-200 font-medium">{asset.prompt}</p>
                <p className="text-xs text-slate-500 font-mono-tabular mt-1">
                  {new Date(asset.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
