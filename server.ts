import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  FOREVERDB_PATCH_DELTAS,
  LATEST_FOREVERDB_VERSION,
} from './src/data/wowForeverData';

dotenv.config();

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/api/foreverdb/patches', (_req, res) => {
  return res.json({
    latestBuild: LATEST_FOREVERDB_VERSION,
    patches: FOREVERDB_PATCH_DELTAS,
    checkedAt: Date.now(),
  });
});

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function generateVisualAid(ai: GoogleGenAI | null, visualPrompt: string): Promise<string | undefined> {
  if (!ai) {
    return '/src/assets/images/wow_forever_map_1794330599949.jpg';
  }
  try {
    const fullPrompt = `World of Warcraft: Forever dark fantasy MMO illustration, ${visualPrompt}, rich obsidian and tarnished gold frame aesthetic, high detail`;
    const imgRes = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: fullPrompt,
      }),
      4500
    );
    const parts = imgRes.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (err) {
    console.warn('Visual aid generation fallback:', err instanceof Error ? err.message : err);
  }
  return '/src/assets/images/wow_forever_map_1794330599949.jpg';
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, systemInstruction, history, requestVisual } = req.body as {
      message: string;
      systemInstruction: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      requestVisual?: boolean;
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const imageUrl = requestVisual
        ? '/src/assets/images/wow_forever_map_1794330599949.jpg'
        : undefined;
      return res.json({
        reply:
          `According to the World of Warcraft: Forever (Build 16001) archives: ` +
          `For "${message}", consult The Cinder Maw (57.0, 51.0) in Ashpeak Mountains for Eternal Forge Tier F1 mechanics, ` +
          `or Veridian Wood (17.0, 52.0) for Ley-line attunement.`,
        imageUrl,
      });
    }

    const contents = [
      ...(history || []).slice(-12).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    let rawText = '';
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
          },
        }),
        5500
      );
      rawText = response.text || '';
    } catch (primaryErr) {
      console.warn('Primary model timed out or busy, using ForeverDB Chronicle synthesis:', primaryErr instanceof Error ? primaryErr.message : primaryErr);
      rawText =
        `From the Chronicles of World of Warcraft: Forever (Build 16001): ` +
        `The Cinder Maw (57.0, 51.0) lies at the molten heart of the Central Caldera beneath Ashpeak Mountains (50.0, 33.0). ` +
        `Within its basalt gates stands the Eternal Forge, where Tier F1 sets such as Mantle of the Eternal Forge (Item Level 78) are tempered, ` +
        `and where Pyrelord Ignis guards the inner sanctum.`;
    }

    const visualMatch = rawText.match(/\[VISUAL:\s*([^\]]+)\]/i);
    const cleanedReply = (rawText || 'No response generated.').replace(/\[VISUAL:\s*[^\]]+\]/gi, '').trim();

    let imageUrl: string | undefined;
    if (visualMatch?.[1] || requestVisual) {
      imageUrl = await generateVisualAid(ai, visualMatch?.[1] || message);
    }

    return res.json({ reply: cleanedReply, imageUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate response.';
    console.error('Chat API error:', msg);
    return res.status(500).json({ error: msg });
  }
});

async function startServer() {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    appType: 'spa',
  });

  // Prevent Vite 8's /@vite/client from opening a failing WebSocket on port 24678 in Cloud Run
  app.get('/@vite/client', async (_req, res, next) => {
    try {
      const result = await vite.transformRequest('/@vite/client');
      if (result?.code) {
        const patchedCode = result.code.replace(
          'const createWebSocketModuleRunnerTransport = (options) => {',
          'const createWebSocketModuleRunnerTransport = () => ({ async connect() {}, async disconnect() {}, send() {} }); const _unusedWsTransport = (options) => {'
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(patchedCode);
      }
    } catch {
      // Fall through to default vite middleware if transformRequest fails
    }
    return next();
  });

  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Forever Atlas server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

