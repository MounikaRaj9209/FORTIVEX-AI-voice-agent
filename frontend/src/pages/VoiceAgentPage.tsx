import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarCheck,
  Clock,
  Globe,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Sparkles,
  User as UserIcon,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { useAuth } from "../context/AuthContext";
import type { CallMessage, CallRecord, Lead, RagSource } from "../types";
import { formatISTTimeSlot } from "../utils/format";

const PHASES = [
  "INTRODUCTION",
  "DISCOVERY",
  "LEAD_QUALIFICATION",
  "PRODUCT_EXPLANATION",
  "OBJECTION_HANDLING",
  "APPOINTMENT_BOOKING",
  "CONCLUSION",
];

const QUICK_PROMPTS_EN = [
  "What are your pricing plans in INR and features?",
  "My name is Arjun Kapoor from FinScale India, budget ₹45,000/month, we need to automate outbound calls this month.",
  "It sounds a bit too expensive right now.",
  "I want to book a demo tomorrow at 11:30 am. My email is arjun@finscale.in.",
];

const QUICK_PROMPTS_HI = [
  "आपके प्राइसिंग प्लान और फीचर्स क्या हैं?",
  "मेरा नाम अमित शर्मा है, हमारा बजट ₹45,000 प्रति माह है और हम इसी महीने शुरू करना चाहते हैं।",
  "कल सुबह 11:30 बजे डेमो अपॉइंटमेंट बुक कर दीजिए।",
];

interface SpeechRecInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((ev: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void)
    | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export function VoiceAgentPage() {
  const { settings } = useAuth();
  const [customerName, setCustomerName] = useState("Website Visitor");
  const [language, setLanguage] = useState(settings?.default_language || "en");
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [leadProfile, setLeadProfile] = useState<Lead | null>(null);
  const [currentPhase, setCurrentPhase] = useState("INTRODUCTION");
  const [sentiment, setSentiment] = useState("Neutral");
  const [buyingIntent, setBuyingIntent] = useState("Medium intent");
  const [appointmentNotice, setAppointmentNotice] = useState<Record<string, string | number> | null>(null);
  const [latestSources, setLatestSources] = useState<RagSource[]>([]);

  const [inputText, setInputText] = useState("");
  const [durationSec, setDurationSec] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [micInterimText, setMicInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, micInterimText]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== "active") return;
    const timer = window.setInterval(() => setDurationSec((d) => d + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activeCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speakNext = useCallback(() => {
    if (isSpeakingRef.current || speakQueueRef.current.length === 0) return;
    if (!autoSpeak) {
      speakQueueRef.current = [];
      return;
    }
    const text = speakQueueRef.current.shift()!;
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = language === "hi" ? "hi-IN" : "en-US";
      utter.rate = 1.0;
      utter.pitch = 1.1;
      utter.volume = 1.0;

      // Pick a good voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const preferred = voices.find((v) =>
          language === "hi"
            ? v.lang.startsWith("hi")
            : v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Google"))
        );
        if (preferred) utter.voice = preferred;
      }

      const done = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        speakNext();
      };
      utter.onend = done;
      utter.onerror = done;
      synthRef.current = utter;
      window.speechSynthesis.speak(utter);
    } else {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [autoSpeak, language]);

  const speakText = useCallback(
    async (text: string) => {
      if (!autoSpeak || !text.trim()) return;

      // Try backend TTS (live mode gives real audio; demo mode returns use_browser_tts=true)
      try {
        const tts = await api.speak(text, language);
        if (!tts.use_browser_tts && tts.audio_base64) {
          // Live OpenAI TTS audio
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          const audio = new Audio(`data:${tts.mime_type};base64,${tts.audio_base64}`);
          audio.onended = () => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            speakNext();
          };
          audio.onerror = () => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            // Fall back to browser TTS
            speakQueueRef.current.unshift(text);
            speakNext();
          };
          await audio.play().catch(() => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            speakQueueRef.current.unshift(tts.text || text);
            speakNext();
          });
          return;
        }
        // Demo mode: use_browser_tts=true — use browser speechSynthesis with the returned text
        const finalText = tts.text || text;
        speakQueueRef.current.push(finalText);
        speakNext();
      } catch {
        // If TTS API fails, still speak via browser
        speakQueueRef.current.push(text);
        speakNext();
      }
    },
    [autoSpeak, language, speakNext]
  );

  const stopSpeaking = useCallback(() => {
    speakQueueRef.current = [];
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // ── Call Lifecycle ─────────────────────────────────────────────────────────
  const handleStartCall = async () => {
    setError(null);
    setAppointmentNotice(null);
    setLatestSources([]);
    setDurationSec(0);
    setMessages([]);
    setLeadProfile(null);
    setCurrentPhase("INTRODUCTION");
    setSentiment("Neutral");
    setBuyingIntent("Medium intent");
    stopSpeaking();
    try {
      const call = await api.startCall({
        customer_name: customerName.trim() || "Website Visitor",
        language,
      });
      setActiveCall(call);
      setMessages(call.messages || []);
      setCurrentPhase(call.current_phase);
      setSentiment(call.sentiment);
      setBuyingIntent(call.buying_intent);
      if (call.lead_id) {
        const l = await api.getLead(call.lead_id);
        setLeadProfile(l);
      }
      if (call.messages?.length) {
        await speakText(call.messages[0].content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
    }
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    stopListening();
    stopSpeaking();
    setIsProcessing(true);
    try {
      const ended = await api.endCall(activeCall.id, durationSec);
      setActiveCall(ended);
      setCurrentPhase("CONCLUSION");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end call");
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessageText = useCallback(
    async (textToSend: string) => {
      const clean = textToSend.trim();
      if (!clean || !activeCall || activeCall.status !== "active") return;
      setError(null);
      setInputText("");
      setMicInterimText("");
      setIsProcessing(true);
      stopSpeaking();
      try {
        const res = await api.sendCallMessage(activeCall.id, {
          message: clean,
          language,
          duration_seconds: durationSec,
        });
        setMessages((prev) => [...prev, res.customer_message, res.assistant_message]);
        setCurrentPhase(res.phase);
        setSentiment(res.sentiment);
        setBuyingIntent(res.buying_intent);
        setLatestSources(res.sources || []);
        if (res.appointment_created) setAppointmentNotice(res.appointment_created);
        if (res.lead_id) {
          const updatedLead = await api.getLead(res.lead_id);
          setLeadProfile(updatedLead);
        }
        await speakText(res.assistant_message.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsProcessing(false);
      }
    },
    [activeCall, durationSec, language, speakText, stopSpeaking]
  );

  // ── Microphone ─────────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    setMicInterimText("");
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!activeCall || activeCall.status !== "active") return;

    // If already listening, stop
    if (isListening) {
      stopListening();
      return;
    }

    // Stop any ongoing AI speech so user can speak
    stopSpeaking();
    setError(null);

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecInstance;
      webkitSpeechRecognition?: new () => SpeechRecInstance;
    };
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    // ── Path A: Browser SpeechRecognition (Chrome / Edge) ──────────────────
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = language === "hi" ? "hi-IN" : "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if ((result as unknown as { isFinal: boolean }).isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (interim) setMicInterimText(interim);
        if (final.trim()) {
          setMicInterimText("");
          setIsListening(false);
          recognitionRef.current = null;
          sendMessageText(final.trim());
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        setMicInterimText("");
        recognitionRef.current = null;
        if (event.error === "not-allowed") {
          setError("Microphone access denied. Please allow microphone permissions in your browser.");
        } else if (event.error !== "aborted") {
          setError(`Mic notice (${event.error}): Please type your message below or try Chrome/Edge.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setMicInterimText("");
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        setError("Could not start microphone. Please type your message.");
      }
      return;
    }

    // ── Path B: MediaRecorder fallback (Firefox, Safari) ───────────────────
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not available in this browser. Please type your message.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          setIsProcessing(true);
          try {
            const stt = await api.transcribe(blob, language);
            if (stt.text.trim()) {
              await sendMessageText(stt.text);
            } else if (stt.note) {
              setError(stt.note);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Audio transcription failed");
          } finally {
            setIsProcessing(false);
          }
        }
      };
      mediaRecorderRef.current = recorder;
      setIsListening(true);
      recorder.start();
    } catch {
      setError("Microphone access denied or unavailable. Please type your message.");
    }
  }, [activeCall, isListening, language, sendMessageText, stopListening, stopSpeaking]);

  const isCallActive = activeCall?.status === "active";
  const quickPrompts = language === "hi" ? QUICK_PROMPTS_HI : QUICK_PROMPTS_EN;
  const activePhaseIdx = Math.max(0, PHASES.indexOf(currentPhase));

  const statusText = isListening
    ? micInterimText
      ? `Heard: "${micInterimText}"`
      : "Listening… speak now"
    : isProcessing
    ? "Thinking & retrieving knowledge…"
    : isSpeaking
    ? "Aria is speaking…"
    : isCallActive
    ? "Mic ready — click 🎤 or type below"
    : "Click Start Call to begin";

  return (
    <div className="space-y-4">
      {/* ── Call Control Dock ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-pink-200/80 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-pink-50 text-xs font-semibold text-pink-700 border border-pink-200">
            <Sparkles className="h-3.5 w-3.5 text-pink-500" />
            AI Voice Agent • {settings?.mode_label || "DEMO MODE"}
          </div>

          <input
            type="text"
            value={customerName}
            disabled={isCallActive}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name"
            className="px-3 py-1.5 text-sm border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:bg-pink-50/60 disabled:text-pink-400"
          />

          <div className="flex items-center gap-1.5 border border-pink-200 rounded-xl px-3 py-1.5 bg-white">
            <Globe className="h-4 w-4 text-pink-400" />
            <select
              value={language}
              disabled={isCallActive}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm bg-transparent focus:outline-none font-medium text-slate-700"
            >
              <option value="en">English (en-US)</option>
              <option value="hi">Hindi (hi-IN)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAutoSpeak((v) => !v);
              if (isSpeaking) stopSpeaking();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pink-200 text-xs font-semibold text-slate-700 hover:bg-pink-50 cursor-pointer"
          >
            {autoSpeak ? (
              <Volume2 className="h-4 w-4 text-pink-500" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
            {autoSpeak ? "Voice On" : "Voice Off"}
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1a0a10] text-white text-xs font-mono tabular-nums">
            <Clock className="h-3.5 w-3.5 text-pink-400" />
            {formatDuration(durationSec)}
          </div>

          {!isCallActive ? (
            <button
              type="button"
              onClick={handleStartCall}
              className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-sm"
            >
              <Phone className="h-4 w-4" />
              Start Call
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEndCall}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-sm"
            >
              <PhoneOff className="h-4 w-4" />
              End Call
            </button>
          )}
        </div>
      </div>

      {/* ── Phase Stepper ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-pink-200/80 px-4 py-3 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between gap-2 min-w-[700px]">
          {PHASES.map((ph, idx) => {
            const isCurrent = ph === currentPhase;
            const isDone = idx < activePhaseIdx;
            return (
              <div
                key={ph}
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-center truncate transition ${
                  isCurrent
                    ? "bg-pink-600 text-white shadow-sm"
                    : isDone
                    ? "bg-pink-50 text-pink-700 border border-pink-200"
                    : "bg-slate-50 text-slate-500"
                }`}
              >
                {idx + 1}. {ph.replace(/_/g, " ")}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <span className="text-rose-400 mt-0.5">⚠</span>
          {error}
        </div>
      )}

      {/* ── Main Split ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Transcript Panel */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-pink-200/80 shadow-sm flex flex-col h-[600px]">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-pink-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isCallActive ? "bg-pink-500 animate-pulse" : "bg-slate-300"
                }`}
              />
              <span className="font-display text-sm font-bold text-slate-900">
                Live Conversation {activeCall ? `· Call #${activeCall.id}` : ""}
              </span>
            </div>
            <div
              className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                isListening
                  ? "bg-pink-50 text-pink-700 border border-pink-200 animate-pulse"
                  : isProcessing
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : isSpeaking
                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                  : "bg-slate-50 text-slate-500 border border-slate-100"
              }`}
            >
              {statusText}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-pink-50/30">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 max-w-md mx-auto">
                <div className="h-14 w-14 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mb-3 border border-pink-200">
                  <Bot className="h-7 w-7" />
                </div>
                <p className="font-display text-sm font-bold text-slate-800">
                  Ready for a 1-on-1 AI Sales Conversation
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Click <strong>Start Call</strong> above, then use the{" "}
                  <strong>🎤 mic button</strong> to speak naturally or type below. Aria will respond
                  with voice and qualify your lead automatically.
                </p>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${m.role === "customer" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role !== "customer" && (
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        m.role === "customer"
                          ? "bg-[#1a0a10] text-white rounded-br-sm"
                          : "bg-white border border-pink-100 text-slate-800 rounded-bl-sm"
                      }`}
                    >
                      <p className="leading-relaxed">{m.content}</p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-pink-100/60 flex flex-wrap gap-1.5">
                          {m.sources.map((s, idx) => (
                            <span
                              key={`${s.document_id}-${idx}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 text-[11px] font-medium border border-pink-100"
                            >
                              <BookOpen className="h-3 w-3" />
                              {s.title} ({Math.round(s.score * 100)}%)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {m.role === "customer" && (
                      <div className="h-8 w-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                        <UserIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Interim speech text bubble */}
                {micInterimText && (
                  <div className="flex gap-3 justify-end">
                    <div className="max-w-[78%] rounded-2xl px-4 py-3 text-sm bg-pink-900/70 text-pink-100 rounded-br-sm italic opacity-80">
                      <p className="leading-relaxed">{micInterimText}…</p>
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                      <UserIcon className="h-4 w-4" />
                    </div>
                  </div>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-white border border-pink-100 text-slate-500 text-sm shadow-sm rounded-bl-sm">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {isCallActive && (
            <div className="px-4 py-2 border-t border-pink-100 bg-pink-50/50 flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isProcessing || isListening}
                  onClick={() => sendMessageText(prompt)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-pink-200 hover:border-pink-400 hover:text-pink-700 text-slate-600 transition cursor-pointer truncate max-w-[230px] disabled:opacity-40"
                  title={prompt}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessageText(inputText);
            }}
            className="p-3 border-t border-pink-100 bg-white flex items-center gap-2 rounded-b-2xl"
          >
            <button
              type="button"
              disabled={!isCallActive || isProcessing}
              onClick={toggleMicrophone}
              title={isListening ? "Stop microphone" : "Speak with microphone"}
              className={`h-10 w-10 rounded-xl flex items-center justify-center transition cursor-pointer disabled:opacity-40 ${
                isListening
                  ? "bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-200"
                  : "bg-pink-100 text-pink-700 hover:bg-pink-200"
              }`}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <input
              type="text"
              disabled={!isCallActive || isProcessing}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isCallActive
                  ? isListening
                    ? "Listening… (or type here)"
                    : "Type a message or click 🎤 to speak"
                  : "Start a call to begin talking to Aria"
              }
              className="flex-1 px-3.5 py-2 text-sm border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:bg-pink-50/60 disabled:text-pink-300"
            />

            <button
              type="submit"
              disabled={!isCallActive || isProcessing || !inputText.trim()}
              className="h-10 px-4 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </form>
        </div>

        {/* ── Right Intelligence Sidebar ──────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Sentiment */}
          <div className="bg-white rounded-2xl border border-pink-200/80 p-5 shadow-sm space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-900">Sentiment & Intent</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={sentiment} />
              <StatusBadge value={buyingIntent} />
            </div>
            <p className="text-xs text-slate-500">
              Phase:{" "}
              <strong className="text-pink-700">{currentPhase.replace(/_/g, " ")}</strong>
            </p>
            {isSpeaking && (
              <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg">
                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                Aria is speaking…
              </div>
            )}
          </div>

          {/* Appointment notice */}
          {appointmentNotice && (
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 text-pink-950 space-y-1">
              <div className="flex items-center gap-2 font-display font-bold text-sm">
                <CalendarCheck className="h-4 w-4 text-pink-600" />
                Appointment Booked!
              </div>
              <p className="text-xs text-pink-800">
                {appointmentNotice.customer_name} · {appointmentNotice.appointment_date} at{" "}
                {formatISTTimeSlot(String(appointmentNotice.appointment_time))}
              </p>
            </div>
          )}

          {/* CRM Profile */}
          <div className="bg-white rounded-2xl border border-pink-200/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">CRM Profile</h3>
              {leadProfile && <StatusBadge value={leadProfile.status} />}
            </div>

            {leadProfile ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1.5">
                    <span>Lead Score</span>
                    <strong className="text-pink-700 tabular-nums">
                      {leadProfile.lead_score} / 100
                    </strong>
                  </div>
                  <div className="w-full h-2 bg-pink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-500"
                      style={{ width: `${leadProfile.lead_score}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-pink-100 text-slate-600">
                  <div>
                    <span className="block text-slate-400">Name</span>
                    <strong className="text-slate-800">{leadProfile.name}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400">Priority</span>
                    <StatusBadge value={leadProfile.priority} />
                  </div>
                  <div>
                    <span className="block text-slate-400">Email</span>
                    <span className="text-slate-800 break-all">{leadProfile.email || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Budget</span>
                    <span className="text-slate-800 font-medium">{leadProfile.budget || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Timeline</span>
                    <span className="text-slate-800 font-medium">{leadProfile.timeline || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Industry</span>
                    <span className="text-slate-800">
                      {leadProfile.industry || leadProfile.company || "—"}
                    </span>
                  </div>
                </div>
                {leadProfile.requirements && (
                  <div className="pt-2 border-t border-pink-100">
                    <span className="block text-slate-400">Requirements</span>
                    <p className="text-slate-700 mt-0.5 leading-relaxed">{leadProfile.requirements}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Start a call to auto-capture and qualify the lead profile.
              </p>
            )}
          </div>

          {/* Post-call summary */}
          {activeCall?.status === "completed" && activeCall.summary && (
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 space-y-1.5">
              <p className="font-display text-xs font-bold text-pink-900">Post-Call Summary</p>
              <p className="text-xs text-pink-800 leading-relaxed">{activeCall.summary.summary}</p>
              <p className="text-[11px] text-pink-700">
                <strong>Next Step:</strong> {activeCall.summary.follow_up_recommendations}
              </p>
            </div>
          )}

          {/* RAG sources */}
          {latestSources.length > 0 && (
            <div className="bg-white rounded-2xl border border-pink-200/80 p-4 shadow-sm space-y-2">
              <h3 className="font-display text-xs font-bold text-slate-900">RAG Sources Used</h3>
              {latestSources.map((s, i) => (
                <div
                  key={i}
                  className="text-[11px] p-2.5 rounded-xl bg-pink-50 border border-pink-100"
                >
                  <p className="font-semibold text-pink-700">{s.title}</p>
                  <p className="text-slate-600 line-clamp-2 mt-0.5">{s.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
