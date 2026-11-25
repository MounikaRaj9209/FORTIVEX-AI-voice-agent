/**
 * VoiceAgentPage – 1-on-1 AI Sales Conversation
 *
 * STT: Web Speech API (Chrome/Edge) → SpeechRecognition with interimResults
 * TTS: Web Speech API (all browsers) → window.speechSynthesis
 *      Backend /api/ai/speak is called; in demo mode it returns
 *      use_browser_tts:true + text, so we call speechSynthesis.speak() here.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Bot, BookOpen, CalendarCheck, Clock, Globe,
  Mic, MicOff, Phone, PhoneOff, Send, Sparkles,
  User as UserIcon, Volume2, VolumeX,
} from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { useAuth } from "../context/AuthContext";
import type { CallMessage, CallRecord, Lead, RagSource } from "../types";
import { formatISTTimeSlot } from "../utils/format";

const PHASES = [
  "INTRODUCTION","DISCOVERY","LEAD_QUALIFICATION",
  "PRODUCT_EXPLANATION","OBJECTION_HANDLING","APPOINTMENT_BOOKING","CONCLUSION",
];

const QUICK_EN = [
  "What are your pricing plans in INR?",
  "My name is Arjun Kapoor from FinScale India, budget ₹45,000/month, need to automate outbound calls this month.",
  "It sounds a bit expensive right now.",
  "Book a demo tomorrow at 11:30 am. Email: arjun@finscale.in.",
];
const QUICK_HI = [
  "आपके प्राइसिंग प्लान क्या हैं?",
  "मेरा नाम अमित शर्मा है, बजट ₹45,000 प्रति माह है।",
  "कल 11:30 AM पर डेमो बुक कीजिए।",
];

/* ─── speak() – reliable cross-browser TTS ─────────────────────────────────
   Splits long text into sentences so Chrome doesn't stall.
   Must be called after a user gesture (button click etc.). */
function speakWithSynthesis(text: string, lang: string, onDone: () => void) {
  if (!("speechSynthesis" in window)) { onDone(); return; }
  window.speechSynthesis.cancel();

  // Split into chunks ≤ 160 chars at sentence boundaries so Chrome doesn't stall
  const sentences = text.match(/[^.!?।]+[.!?।]*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > 160) { if (cur) chunks.push(cur.trim()); cur = s; }
    else cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());

  let idx = 0;

  const speakChunk = () => {
    if (idx >= chunks.length) { onDone(); return; }
    const utter = new SpeechSynthesisUtterance(chunks[idx++]);
    utter.lang   = lang === "hi" ? "hi-IN" : "en-US";
    utter.rate   = 0.95;
    utter.pitch  = 1.05;
    utter.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const pick = voices.find(v =>
      lang === "hi"
        ? v.lang.startsWith("hi")
        : v.lang.startsWith("en") && /Google|Samantha|Zira|David|Female/i.test(v.name)
    ) ?? voices.find(v => lang === "hi" ? v.lang.startsWith("hi") : v.lang.startsWith("en"));
    if (pick) utter.voice = pick;

    // Chrome stall guard – resume if paused
    const guard = setInterval(() => {
      if (!window.speechSynthesis.speaking) clearInterval(guard);
      else if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 800);

    utter.onend   = () => { clearInterval(guard); speakChunk(); };
    utter.onerror = () => { clearInterval(guard); speakChunk(); };

    window.speechSynthesis.speak(utter);
  };

  speakChunk();
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export function VoiceAgentPage() {
  const { settings } = useAuth();

  // call state
  const [customerName, setCustomerName] = useState("Website Visitor");
  const [language, setLanguage]         = useState(settings?.default_language ?? "en");
  const [activeCall, setActiveCall]     = useState<CallRecord | null>(null);
  const [messages, setMessages]         = useState<CallMessage[]>([]);
  const [leadProfile, setLeadProfile]   = useState<Lead | null>(null);
  const [currentPhase, setCurrentPhase] = useState("INTRODUCTION");
  const [sentiment, setSentiment]       = useState("Neutral");
  const [buyingIntent, setBuyingIntent] = useState("Medium intent");
  const [apptNotice, setApptNotice]     = useState<Record<string,string|number>|null>(null);
  const [sources, setSources]           = useState<RagSource[]>([]);

  // ui state
  const [inputText, setInputText]       = useState("");
  const [elapsed, setElapsed]           = useState(0);
  const [listening, setListening]       = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [speaking, setSpeaking]         = useState(false);
  const [voiceOn, setVoiceOn]           = useState(true);
  const [interim, setInterim]           = useState("");
  const [error, setError]               = useState<string|null>(null);

  // refs – stable across renders
  const recRef    = useRef<SpeechRecognition|null>(null);
  const bottomRef = useRef<HTMLDivElement|null>(null);
  const langRef   = useRef(language);       // always current lang without stale closure
  const voiceRef  = useRef(voiceOn);

  useEffect(() => { langRef.current  = language; }, [language]);
  useEffect(() => { voiceRef.current = voiceOn;  }, [voiceOn]);

  // scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, interim]);

  // timer
  useEffect(() => {
    if (activeCall?.status !== "active") return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  // pre-load voices (Chrome async)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  /* ── helpers ── */
  const fmt = (s: number) =>
    `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const stopSpeech = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const stopListening = useCallback(() => {
    if (recRef.current) { try { recRef.current.abort(); } catch {} recRef.current = null; }
    setListening(false);
    setInterim("");
  }, []);

  /* ── speak a reply ── */
  const speakReply = useCallback((text: string) => {
    if (!voiceRef.current || !text.trim()) return;
    setSpeaking(true);
    speakWithSynthesis(text, langRef.current, () => setSpeaking(false));
  }, []);

  /* ── send message to backend ── */
  const sendMsg = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || !activeCall || activeCall.status !== "active") return;

    stopSpeech();
    setError(null);
    setInputText("");
    setInterim("");
    setProcessing(true);

    try {
      const res = await api.sendCallMessage(activeCall.id, {
        message: clean,
        language: langRef.current,
        duration_seconds: elapsed,
      });

      setMessages(prev => [...prev, res.customer_message, res.assistant_message]);
      setCurrentPhase(res.phase);
      setSentiment(res.sentiment);
      setBuyingIntent(res.buying_intent);
      setSources(res.sources ?? []);
      if (res.appointment_created) setApptNotice(res.appointment_created);
      if (res.lead_id) setLeadProfile(await api.getLead(res.lead_id));

      speakReply(res.assistant_message.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setProcessing(false);
    }
  }, [activeCall, elapsed, stopSpeech, speakReply]);

  /* ── start call ── */
  const startCall = async () => {
    stopSpeech();
    stopListening();
    setError(null);
    setMessages([]);
    setLeadProfile(null);
    setCurrentPhase("INTRODUCTION");
    setSentiment("Neutral");
    setBuyingIntent("Medium intent");
    setApptNotice(null);
    setSources([]);
    setElapsed(0);
    setInterim("");

    try {
      const call = await api.startCall({
        customer_name: customerName.trim() || "Website Visitor",
        language,
      });
      setActiveCall(call);
      setMessages(call.messages ?? []);
      setCurrentPhase(call.current_phase);
      setSentiment(call.sentiment);
      setBuyingIntent(call.buying_intent);
      if (call.lead_id) setLeadProfile(await api.getLead(call.lead_id));

      // Speak greeting after a short delay (browser needs gesture to have settled)
      if (call.messages?.length) {
        setTimeout(() => speakReply(call.messages[0].content), 400);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
    }
  };

  /* ── end call ── */
  const endCall = async () => {
    if (!activeCall) return;
    stopListening();
    stopSpeech();
    setProcessing(true);
    try {
      const ended = await api.endCall(activeCall.id, elapsed);
      setActiveCall(ended);
      setCurrentPhase("CONCLUSION");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end call");
    } finally {
      setProcessing(false);
    }
  };

  /* ── microphone toggle ── */
  const toggleMic = useCallback(() => {
    if (!activeCall || activeCall.status !== "active") return;

    // already listening → stop
    if (listening) { stopListening(); return; }

    const SR =
      (window as unknown as Record<string,unknown>).SpeechRecognition as (new() => SpeechRecognition) | undefined ??
      (window as unknown as Record<string,unknown>).webkitSpeechRecognition as (new() => SpeechRecognition) | undefined;

    if (!SR) {
      setError("Speech recognition requires Chrome or Edge. Please type your message below.");
      return;
    }

    stopSpeech(); // stop Aria so she doesn't echo into the mic
    setError(null);
    setInterim("");

    const rec = new SR();
    rec.lang            = langRef.current === "hi" ? "hi-IN" : "en-US";
    rec.interimResults  = true;
    rec.continuous      = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let fin = "", int = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else int += t;
      }
      if (int) setInterim(int);
      if (fin.trim()) {
        setInterim("");
        setListening(false);
        recRef.current = null;
        try { rec.abort(); } catch {}
        sendMsg(fin.trim());
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setListening(false); setInterim(""); recRef.current = null;
      if (e.error === "not-allowed")
        setError("Microphone access denied. Click the 🔒 lock icon in the address bar → allow microphone, then refresh.");
      else if (e.error === "no-speech")
        setError("No speech detected. Please try again or type below.");
      else if (e.error !== "aborted")
        setError(`Mic error (${e.error}). Try again or type below.`);
    };

    rec.onend = () => { setListening(false); setInterim(""); };

    recRef.current = rec;
    try { rec.start(); } catch {
      setError("Could not start microphone. Try clicking the button again.");
      setListening(false);
      recRef.current = null;
    }
  }, [activeCall, listening, stopListening, stopSpeech, sendMsg]);

  /* ── derived ── */
  const isActive = activeCall?.status === "active";
  const prompts  = language === "hi" ? QUICK_HI : QUICK_EN;
  const phaseIdx = Math.max(0, PHASES.indexOf(currentPhase));

  const statusLabel =
    listening   ? (interim ? `Heard: "${interim}"` : "🎤 Listening… speak now")
    : processing ? "⏳ Thinking…"
    : speaking   ? "🔊 Aria is speaking…"
    : isActive   ? "Ready — click 🎤 or type below"
    : "Click Start Call to begin";

  /* ── render ── */
  return (
    <div className="space-y-4">

      {/* ── control bar ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-pink-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-pink-50 text-xs font-semibold text-pink-700 border border-pink-200">
            <Sparkles className="h-3.5 w-3.5 text-pink-500" />
            AI Voice Agent · {settings?.mode_label ?? "DEMO MODE"}
          </div>

          <input
            type="text" value={customerName} disabled={isActive}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Customer name"
            className="px-3 py-1.5 text-sm border border-pink-200 rounded-xl w-44 focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:bg-pink-50/60 disabled:text-pink-400"
          />

          <div className="flex items-center gap-1.5 border border-pink-200 rounded-xl px-3 py-1.5">
            <Globe className="h-4 w-4 text-pink-400" />
            <select value={language} disabled={isActive}
              onChange={e => setLanguage(e.target.value)}
              className="text-sm bg-transparent focus:outline-none font-medium text-slate-700">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => { setVoiceOn(v => !v); if (speaking) stopSpeech(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pink-200 text-xs font-semibold text-slate-700 hover:bg-pink-50 cursor-pointer">
            {voiceOn ? <Volume2 className="h-4 w-4 text-pink-500"/> : <VolumeX className="h-4 w-4 text-slate-400"/>}
            {voiceOn ? "Voice On" : "Voice Off"}
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1a0a10] text-white text-xs font-mono tabular-nums">
            <Clock className="h-3.5 w-3.5 text-pink-400"/>{fmt(elapsed)}
          </div>

          {!isActive
            ? <button onClick={startCall}
                className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-sm">
                <Phone className="h-4 w-4"/> Start Call
              </button>
            : <button onClick={endCall} disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-sm">
                <PhoneOff className="h-4 w-4"/> End Call
              </button>
          }
        </div>
      </div>

      {/* ── phase stepper ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-pink-200 px-4 py-3 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 min-w-[700px]">
          {PHASES.map((ph, i) => (
            <div key={ph} className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-center truncate transition ${
              ph === currentPhase ? "bg-pink-600 text-white shadow-sm"
              : i < phaseIdx     ? "bg-pink-50 text-pink-700 border border-pink-200"
              : "bg-slate-50 text-slate-400"}`}>
              {i+1}. {ph.replace(/_/g," ")}
            </div>
          ))}
        </div>
      </div>

      {/* ── error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer shrink-0">✕</button>
        </div>
      )}

      {/* ── main grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* transcript */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-pink-200 shadow-sm flex flex-col h-[600px]">

          {/* header bar */}
          <div className="px-5 py-3 border-b border-pink-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-pink-500 animate-pulse" : "bg-slate-300"}`}/>
              <span className="font-display text-sm font-bold text-slate-900">
                Live Conversation {activeCall ? `· Call #${activeCall.id}` : ""}
              </span>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
              listening   ? "bg-pink-50 text-pink-700 border-pink-200 animate-pulse"
              : processing ? "bg-amber-50 text-amber-700 border-amber-200"
              : speaking   ? "bg-purple-50 text-purple-700 border-purple-200 animate-pulse"
              : "bg-slate-50 text-slate-500 border-slate-100"}`}>
              {statusLabel}
            </span>
          </div>

          {/* message list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-pink-50/20">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto gap-3">
                <div className="h-14 w-14 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center border border-pink-200">
                  <Bot className="h-7 w-7"/>
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-slate-800">Ready for a 1-on-1 AI Sales Conversation</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Click <strong>Start Call</strong> → then hit <strong>🎤</strong> to speak or type below.<br/>
                    Aria replies with voice and auto-qualifies your lead.
                  </p>
                </div>
                <div className="text-xs text-pink-700 bg-pink-50 border border-pink-200 rounded-xl px-3 py-2 w-full text-left">
                  💡 <strong>Speech works in Chrome &amp; Edge.</strong> Make sure to allow microphone when prompted.
                </div>
              </div>
            ) : (
              <>
                {messages.map(m => (
                  <div key={m.id} className={`flex gap-3 ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                    {m.role !== "customer" && (
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Bot className="h-4 w-4"/>
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      m.role === "customer"
                        ? "bg-[#1a0a10] text-white rounded-br-sm"
                        : "bg-white border border-pink-100 text-slate-800 rounded-bl-sm"}`}>
                      <p className="leading-relaxed">{m.content}</p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-pink-100/60 flex flex-wrap gap-1">
                          {m.sources.map((s,i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 text-[11px] font-medium border border-pink-100">
                              <BookOpen className="h-3 w-3"/>{s.title} ({Math.round(s.score*100)}%)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {m.role === "customer" && (
                      <div className="h-8 w-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                        <UserIcon className="h-4 w-4"/>
                      </div>
                    )}
                  </div>
                ))}

                {/* interim speech preview */}
                {interim && (
                  <div className="flex gap-3 justify-end">
                    <div className="max-w-[78%] rounded-2xl px-4 py-3 text-sm bg-pink-900/60 text-pink-100 rounded-br-sm italic opacity-80">
                      {interim}…
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                      <UserIcon className="h-4 w-4"/>
                    </div>
                  </div>
                )}

                {/* thinking dots */}
                {processing && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Bot className="h-4 w-4"/>
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-white border border-pink-100 shadow-sm rounded-bl-sm flex items-center gap-1.5">
                      {[0,150,300].map(d => (
                        <span key={d} className="h-2 w-2 rounded-full bg-pink-400 animate-bounce" style={{animationDelay:`${d}ms`}}/>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* quick prompts */}
          {isActive && (
            <div className="px-4 py-2 border-t border-pink-100 bg-pink-50/40 flex flex-wrap gap-1.5">
              {prompts.map((p,i) => (
                <button key={i} type="button"
                  disabled={processing || listening}
                  onClick={() => sendMsg(p)} title={p}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-pink-200 hover:border-pink-500 hover:text-pink-700 text-slate-600 transition cursor-pointer truncate max-w-[230px] disabled:opacity-40">
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* input bar */}
          <form onSubmit={e => { e.preventDefault(); sendMsg(inputText); }}
            className="p-3 border-t border-pink-100 bg-white flex items-center gap-2 rounded-b-2xl">

            <button type="button"
              disabled={!isActive || processing}
              onClick={toggleMic}
              title={listening ? "Stop microphone" : "Speak (Chrome/Edge)"}
              className={`h-10 w-10 rounded-xl flex items-center justify-center transition cursor-pointer disabled:opacity-40 shrink-0 ${
                listening
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-200 animate-pulse"
                  : "bg-pink-100 text-pink-700 hover:bg-pink-200"}`}>
              {listening ? <MicOff className="h-5 w-5"/> : <Mic className="h-5 w-5"/>}
            </button>

            <input type="text"
              disabled={!isActive || processing}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={!isActive ? "Start a call to begin" : listening ? "Listening… (or type here)" : "Type a message or click 🎤 to speak"}
              className="flex-1 px-3.5 py-2 text-sm border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:bg-pink-50/50 disabled:text-pink-300"
            />

            <button type="submit"
              disabled={!isActive || processing || !inputText.trim()}
              className="h-10 px-4 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shrink-0">
              <Send className="h-4 w-4"/> Send
            </button>
          </form>
        </div>

        {/* ── right sidebar ──────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">

          {/* sentiment */}
          <div className="bg-white rounded-2xl border border-pink-200 p-5 shadow-sm space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-900">Sentiment & Intent</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={sentiment}/>
              <StatusBadge value={buyingIntent}/>
            </div>
            <p className="text-xs text-slate-500">
              Phase: <strong className="text-pink-700">{currentPhase.replace(/_/g," ")}</strong>
            </p>
            {speaking && (
              <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg">
                <Volume2 className="h-3.5 w-3.5 animate-pulse"/> Aria is speaking…
              </div>
            )}
          </div>

          {/* appointment */}
          {apptNotice && (
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-2 font-display font-bold text-sm text-pink-900">
                <CalendarCheck className="h-4 w-4 text-pink-600"/> Appointment Booked!
              </div>
              <p className="text-xs text-pink-800">
                {apptNotice.customer_name} · {apptNotice.appointment_date} at {formatISTTimeSlot(String(apptNotice.appointment_time))}
              </p>
            </div>
          )}

          {/* CRM profile */}
          <div className="bg-white rounded-2xl border border-pink-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">CRM Profile</h3>
              {leadProfile && <StatusBadge value={leadProfile.status}/>}
            </div>
            {leadProfile ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1.5">
                    <span>Lead Score</span>
                    <strong className="text-pink-700 tabular-nums">{leadProfile.lead_score} / 100</strong>
                  </div>
                  <div className="w-full h-2 bg-pink-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-500"
                      style={{width:`${leadProfile.lead_score}%`}}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-pink-100">
                  {[["Name",leadProfile.name],["Email",leadProfile.email||"—"],
                    ["Budget",leadProfile.budget||"—"],["Timeline",leadProfile.timeline||"—"],
                    ["Industry",leadProfile.industry||leadProfile.company||"—"]
                  ].map(([l,v])=>(
                    <div key={l}><span className="block text-slate-400">{l}</span>
                      <span className="text-slate-800 font-medium break-all">{v}</span></div>
                  ))}
                  <div><span className="block text-slate-400">Priority</span>
                    <StatusBadge value={leadProfile.priority}/></div>
                </div>
                {leadProfile.requirements && (
                  <div className="pt-2 border-t border-pink-100">
                    <span className="block text-slate-400 mb-0.5">Requirements</span>
                    <p className="text-slate-700 leading-relaxed">{leadProfile.requirements}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Start a call to auto-capture and qualify the lead.</p>
            )}
          </div>

          {/* post-call summary */}
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
          {sources.length > 0 && (
            <div className="bg-white rounded-2xl border border-pink-200 p-4 shadow-sm space-y-2">
              <h3 className="font-display text-xs font-bold text-slate-900">RAG Sources Used</h3>
              {sources.map((s,i) => (
                <div key={i} className="text-[11px] p-2.5 rounded-xl bg-pink-50 border border-pink-100">
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
