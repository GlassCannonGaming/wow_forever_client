import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Compass,
  Mic,
  MicOff,
  Radio,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ChatMessage, InstructionConfig, MapRegion } from '../types';
import { parseTextWithLocationLinks } from '../utils/foreverDbParser';
import {
  extractSpeechTranscript,
  mergeDictatedInput,
  resolveSpeechRecognitionLang,
} from '../utils/memory';

export interface LocationLinkTarget {
  regionId?: string;
  x: number;
  y: number;
  label: string;
}

interface VoiceChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  instructionConfig: InstructionConfig;
  regions: MapRegion[];
  onSendMessage: (text: string) => void;
  onToggleAutoSpeak: () => void;
  onSelectLocationLink: (target: LocationLinkTarget) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  isFinal?: boolean;
  length?: number;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechConstructor = new () => SpeechRecognitionLike;

function getBrowserSpeechRecognition(): SpeechConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function speakWithConfig(text: string, config: InstructionConfig) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = config.voicePitch;
  utterance.rate = config.voiceRate;

  const langTag = resolveSpeechRecognitionLang(config.voiceAccent);
  utterance.lang = langTag;

  const voices = window.speechSynthesis.getVoices();
  if (config.voiceName !== 'default') {
    const exactMatch = voices.find((v) => v.name === config.voiceName);
    if (exactMatch) {
      utterance.voice = exactMatch;
    }
  } else {
    const accentMatch = voices.find((v) =>
      v.lang.toLowerCase().startsWith(langTag.toLowerCase())
    );
    if (accentMatch) {
      utterance.voice = accentMatch;
    }
  }

  window.speechSynthesis.speak(utterance);
}

export const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({
  messages,
  isLoading,
  instructionConfig,
  regions,
  onSendMessage,
  onToggleAutoSpeak,
  onSelectLocationLink,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [autoSendVoice, setAutoSendVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseInputBeforeListenRef = useRef<string>('');
  const latestTranscriptRef = useRef<string>('');
  const autoSendRef = useRef<boolean>(autoSendVoice);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    autoSendRef.current = autoSendVoice;
  }, [autoSendVoice]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort?.();
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors on unmount
        }
      }
    };
  }, []);

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const toggleVoiceInput = () => {
    setVoiceError(null);

    if (isListening) {
      stopVoiceInput();
      return;
    }

    const SpeechRec = getBrowserSpeechRecognition();
    if (!SpeechRec) {
      setVoiceError(
        'Browser SpeechRecognition is not available in this browser environment. Try Chrome or Edge for live voice dictation.'
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = resolveSpeechRecognitionLang(instructionConfig.voiceAccent);

      baseInputBeforeListenRef.current = input;
      latestTranscriptRef.current = '';
      setInterimTranscript('');

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const { finalTranscript, interimTranscript: liveInterim, combinedTranscript } =
          extractSpeechTranscript(event.results);

        setInterimTranscript(liveInterim);

        if (combinedTranscript) {
          latestTranscriptRef.current = combinedTranscript;
          const nextText = mergeDictatedInput(
            baseInputBeforeListenRef.current,
            combinedTranscript
          );
          setInput(nextText);
        }

        if (finalTranscript && autoSendRef.current && !liveInterim) {
          const toSend = mergeDictatedInput(
            baseInputBeforeListenRef.current,
            finalTranscript
          );
          if (toSend.trim()) {
            onSendMessage(toSend.trim());
            setInput('');
            baseInputBeforeListenRef.current = '';
            latestTranscriptRef.current = '';
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const code = event?.error || 'unknown';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setVoiceError(
            'Microphone access was denied. Enable microphone permission in your browser settings to dictate messages.'
          );
        } else if (code === 'no-speech') {
          setVoiceError('No speech detected. Click the microphone and speak your question clearly.');
        } else if (code === 'audio-capture') {
          setVoiceError('No microphone device detected. Connect a microphone to use voice input.');
        } else if (code !== 'aborted') {
          setVoiceError(`Voice recognition interrupted (${code}). Please try again.`);
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError('Could not initialize SpeechRecognition. Check microphone permissions.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (isListening) {
      stopVoiceInput();
    }
    onSendMessage(input.trim());
    setInput('');
    baseInputBeforeListenRef.current = '';
    latestTranscriptRef.current = '';
  };

  const renderMessageWithLocationLinks = (content: string) => {
    const segments = parseTextWithLocationLinks(content, regions);
    return segments.map((seg, idx) => {
      if (seg.type === 'location' && seg.x !== undefined && seg.y !== undefined) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() =>
              onSelectLocationLink({
                regionId: seg.regionId,
                x: seg.x!,
                y: seg.y!,
                label: seg.regionName || seg.text,
              })
            }
            title={`Center & auto-zoom map on ${seg.regionName || seg.text} (${seg.x.toFixed(
              1
            )}, ${seg.y.toFixed(1)})`}
            className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-[#261d11] border border-[#8c6d3b] text-[#ffd100] hover:bg-[#382a17] hover:border-[#ffd100] font-medium text-xs align-baseline transition-colors cursor-pointer"
          >
            <Compass className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{seg.text}</span>
          </button>
        );
      }
      return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
    });
  };

  const recognitionLocale = resolveSpeechRecognitionLang(instructionConfig.voiceAccent);

  return (
    <div className="flex flex-col h-full min-h-[500px] rounded-lg wow-frame overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#4a391f] bg-[#120f0b]">
        <div>
          <h2 className="text-base font-bold text-[#ffd100] tracking-wide">
            Chronicle Companion
          </h2>
          <p className="text-xs text-[#b8a382] font-mono-tabular">
            World of Warcraft: Forever · Voice &amp; Visual Tome
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="toggle-auto-send-voice"
            onClick={() => setAutoSendVoice((prev) => !prev)}
            title={
              autoSendVoice
                ? 'Voice input will send automatically when you finish speaking'
                : 'Voice input dictates into the text box for review before sending'
            }
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              autoSendVoice ? 'wow-button-primary' : 'wow-button-secondary'
            }`}
          >
            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{autoSendVoice ? 'Auto-Send Mic' : 'Dictate Text'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleAutoSpeak}
            aria-label={instructionConfig.autoSpeak ? 'Disable auto-speak' : 'Enable auto-speak'}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              instructionConfig.autoSpeak
                ? 'wow-button-primary'
                : 'wow-button-secondary'
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
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#3b2813] border border-[#8c6d3b] text-[#fff3d1]'
                  : 'wow-inset text-[#e6d5b8]'
              }`}
            >
              <p className="whitespace-pre-wrap">
                {renderMessageWithLocationLinks(msg.content)}
              </p>

              {/* AI-Generated Visual Aid when answering visually */}
              {msg.role === 'assistant' && msg.imageUrl && (
                <div className="mt-3 overflow-hidden rounded border border-[#6e562f] bg-[#090806]">
                  <img
                    src={msg.imageUrl}
                    alt="Companion visual illustration"
                    referrerPolicy="no-referrer"
                    className="w-full aspect-video object-cover"
                  />
                  <div className="px-2.5 py-1.5 bg-[#120f0b] border-t border-[#4a391f] text-[11px] text-[#c9b38c]">
                    Visual Chronicle Illustration — World of Warcraft: Forever
                  </div>
                </div>
              )}

              {msg.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => speakWithConfig(msg.content, instructionConfig)}
                  aria-label="Read message aloud"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#b8a382] hover:text-[#ffd100] transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" aria-hidden="true" />
                  Speak Aloud
                </button>
              )}
            </div>
            <span className="mt-1 text-[11px] text-[#857256] font-mono-tabular">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="rounded-md wow-inset px-4 py-2.5 text-sm text-[#c9b38c]">
              Consulting the Forever Chronicles...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Live SpeechRecognition Listening Banner */}
      {isListening && (
        <div
          data-testid="voice-listening-banner"
          role="status"
          aria-live="polite"
          className="px-3.5 py-2 border-t border-[#6e562f] bg-[#1c140c] flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff4d4d] animate-pulse shrink-0" />
            <span className="font-semibold text-[#ffd100] shrink-0">
              Listening ({recognitionLocale}):
            </span>
            <span
              data-testid="voice-interim-transcript"
              className="text-[#f3ead8] italic truncate"
            >
              {interimTranscript || input || 'Speak your question into the microphone...'}
            </span>
          </div>
          <button
            type="button"
            onClick={stopVoiceInput}
            className="text-[11px] font-semibold text-[#ffd100] hover:underline shrink-0 cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* SpeechRecognition Error Banner */}
      {voiceError && (
        <div
          data-testid="voice-error-banner"
          role="alert"
          className="px-3.5 py-2 border-t border-[#7a1616] bg-[#241010] flex items-center justify-between gap-2 text-xs text-[#ffb3b3]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-[#ff4d4d] shrink-0" aria-hidden="true" />
            <span>{voiceError}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss voice error"
            onClick={() => setVoiceError(null)}
            className="text-[#ffb3b3] hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-[#4a391f] bg-[#120f0b] flex items-center gap-2"
      >
        <button
          type="button"
          data-testid="voice-input-button"
          onClick={toggleVoiceInput}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          aria-pressed={isListening}
          title={
            isListening
              ? 'Stop voice recognition'
              : `Dictate message with microphone (${recognitionLocale})`
          }
          className={`min-h-[44px] min-w-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded transition-colors cursor-pointer shrink-0 ${
            isListening
              ? 'bg-[#7a1616] text-[#ffd100] border border-[#ffd100] shadow-[0_0_10px_rgba(255,77,77,0.45)]'
              : 'wow-button-secondary'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-semibold hidden sm:inline">Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-semibold hidden sm:inline">Voice</span>
            </>
          )}
        </button>

        <input
          type="text"
          data-testid="chat-text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? 'Listening... speak your World of Warcraft: Forever question'
              : 'Ask about Forever zones, bosses, gear, or click Voice to speak...'
          }
          aria-label="Ask WoW Forever companion"
          className="flex-1 min-h-[44px] rounded wow-inset px-3.5 py-2 text-sm text-[#f3ead8] placeholder:text-[#78664c] focus:outline-none focus:border-[#c99e4c]"
        />

        <button
          type="submit"
          data-testid="chat-send-button"
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          className="min-h-[44px] px-4 rounded wow-button-primary font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>
    </div>
  );
};
