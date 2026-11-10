import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '4mb' }));

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

app.post('/api/chat', async (req, res) => {
  try {
    const { message, systemInstruction, history } = req.body as {
      message: string;
      systemInstruction: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        reply:
          `[WoW Forever Offline Reference] Based on World of Warcraft: Forever documentation: ` +
          `For "${message}", check The Cinder Maw (57, 51) in Ashpeak Mountains for Eternal Forge Tier F1 mechanics, ` +
          `or Veridian Wood (17, 52) for Ley-line attunement quests. (Configure GEMINI_API_KEY in Secrets for live AI responses.)`,
      });
    }

    const contents = [
      ...(history || []).slice(-12).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
      },
    });

    return res.json({ reply: response.text || 'No response generated.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate response.';
    console.error('Chat API error:', msg);
    return res.status(500).json({ error: msg });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string };
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in Secrets for live image generation.',
      });
    }

    const fullPrompt = `World of Warcraft: Forever fantasy MMO concept art, ${prompt}, rich dark obsidian and gold aesthetic, high detail`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: fullPrompt,
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return res.json({
          imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
        });
      }
    }

    return res.status(500).json({ error: 'No image data returned from model.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Image generation failed.';
    console.error('Image API error:', msg);
    return res.status(500).json({ error: msg });
  }
});

async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Forever Atlas server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
