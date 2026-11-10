import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import type { ChatMessage, InstructionConfig } from '../types';

interface VoiceChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  instructionConfig: InstructionConfig;
  onSendMessage: (text: string) => void;
  onToggleAutoSpeak: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({
  messages,
  isLoading,
  instructionConfig,
  onSendMessage,
  onToggleAutoSpeak,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = instructionConfig.voicePitch;
    utterance.rate = instructionConfig.voiceRate;
    if (instructionConfig.voiceName !== 'default') {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === instructionConfig.voiceName);
      if (match) utterance.voice = match;
    }
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onSendMessage(transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full min-h-[460px] rounded-xl border border-slate-800 bg-[#141720] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Forever Companion</h2>
          <p className="text-xs text-slate-400">
            Strictly World of Warcraft: Forever · 72h Memory Active
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleAutoSpeak}
          aria-label={instructionConfig.autoSpeak ? 'Disable auto-speak' : 'Enable auto-speak'}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            instructionConfig.autoSpeak
              ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
              : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          {instructionConfig.autoSpeak ? (
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{instructionConfig.autoSpeak ? 'Voice On' : 'Voice Off'}</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-600 text-slate-950 font-medium'
                  : 'bg-[#0d0f14] border border-slate-800 text-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => speakText(msg.content)}
                  aria-label="Read message aloud"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" aria-hidden="true" />
                  Speak
                </button>
              )}
            </div>
            <span className="mt-1 text-[11px] text-slate-500 font-mono-tabular">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="rounded-xl border border-slate-800 bg-[#0d0f14] px-4 py-2.5 text-sm text-slate-400">
              Consulting WoW Forever archives...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-800 bg-[#0d0f14] flex items-center gap-2"
      >
        <button
          type="button"
          onClick={toggleVoiceInput}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
            isListening
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'border border-slate-700 bg-[#141720] text-slate-300 hover:bg-slate-800'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about WoW Forever quests, bosses, zones..."
          aria-label="Ask WoW Forever companion"
          className="flex-1 min-h-[44px] rounded-lg border border-slate-700 bg-[#141720] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          className="min-h-[44px] px-4 rounded-lg bg-amber-600 text-slate-950 font-semibold text-sm hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
