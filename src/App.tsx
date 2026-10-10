import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Power,
  ExternalLink,
  Search,
  Brain,
  Timer,
  Compass,
  ShieldCheck,
  Volume2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { AssistantState, ExecutedActionItem, LiveSession } from "./session/LiveSession";
import { AudioLevels } from "./audio/AudioStreamer";
import { JarvisVisualizer } from "./components/JarvisVisualizer";

const VOICE_OPTIONS = [
  { id: "Kore", label: "Kore (Warm & Expressive)" },
  { id: "Aoede", label: "Aoede (Bright & Articulate)" },
  { id: "Zephyr", label: "Zephyr (Calm & Crisp)" },
  { id: "Puck", label: "Puck (Witty & Energetic)" },
];

const QUICK_VOICE_PROMPTS = [
  {
    title: "Creator Identity",
    subtitle: "Ask: Tumko kisne banaya hai?",
    prompt: "Jarvis, tumko kisne banaya hai? Apne creator Chandan Sir aur apni personality ke baare mein batao!",
  },
  {
    title: "Detective Mind Deduction",
    subtitle: "Test analytical reasoning & accuracy",
    prompt:
      "Jarvis, use your detective mind and log a clue on my screen: If a room has no windows and a locked door from the inside, how does a detective approach the investigation logically?",
  },
  {
    title: "Open YouTube",
    subtitle: "Trigger openWebsite browser action",
    prompt: "Jarvis, please open YouTube for me using your openWebsite tool.",
  },
  {
    title: "Investigate Quantum Computing",
    subtitle: "Trigger Wikipedia search & voice brief",
    prompt: "Jarvis, search Wikipedia for Quantum Computing and explain it to me like Tony Stark in 30 seconds.",
  },
];

export default function App() {
  const [state, setState] = useState<AssistantState>("disconnected");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actions, setActions] = useState<ExecutedActionItem[]>([]);
  const [activeSection, setActiveSection] = useState<"core" | "detective" | "actions">("core");
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);

  const [audioLevels, setAudioLevels] = useState<AudioLevels>({
    inputVolume: 0,
    outputVolume: 0,
    bands: new Array(24).fill(0.06),
  });

  const sessionRef = useRef<LiveSession | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const liveSession = new LiveSession({
      onStateChange: (nextState) => {
        setState(nextState);
        if (nextState === "disconnected") {
          setIsMuted(false);
        }
      },
      onActionExecuted: (actionItem) => {
        setActions((prev) => [actionItem, ...prev.slice(0, 14)]);
      },
      onError: (err) => {
        setErrorMsg(err);
      },
    });

    sessionRef.current = liveSession;

    return () => {
      liveSession.disconnect();
    };
  }, []);

  // Poll audio spectrum smoothly at 60fps when session is active
  useEffect(() => {
    const updateSpectrum = () => {
      if (sessionRef.current && (state === "listening" || state === "speaking")) {
        setAudioLevels(sessionRef.current.getAudioLevels());
      } else {
        setAudioLevels({
          inputVolume: 0,
          outputVolume: 0,
          bands: new Array(24).fill(0.06),
        });
      }
      rafRef.current = requestAnimationFrame(updateSpectrum);
    };

    rafRef.current = requestAnimationFrame(updateSpectrum);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state]);

  // Session duration counter
  useEffect(() => {
    if (state === "disconnected") {
      setSessionSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  const handleTogglePower = () => {
    if (!sessionRef.current) return;
    if (state === "disconnected") {
      sessionRef.current.connect(selectedVoice);
    } else {
      sessionRef.current.disconnect();
    }
  };

  const handleToggleMute = () => {
    if (!sessionRef.current || state === "disconnected") return;
    const muted = sessionRef.current.toggleMute();
    setIsMuted(muted);
  };

  const handleTriggerCue = (prompt: string) => {
    if (!sessionRef.current) return;
    if (state === "disconnected") {
      sessionRef.current.connect(selectedVoice).then(() => {
        setTimeout(() => {
          sessionRef.current?.sendVoiceTopicCue(prompt);
        }, 900);
      });
    } else {
      sessionRef.current.sendVoiceTopicCue(prompt);
    }
  };

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getStateDescription = () => {
    if (state === "connecting") {
      return "Establishing encrypted 16kHz/24kHz audio bridge with Jarvis...";
    }
    if (state === "speaking") {
      return "Jarvis is speaking — interrupt anytime simply by talking.";
    }
    if (state === "listening") {
      return isMuted
        ? "Microphone is muted. Unmute to speak with Jarvis."
        : "Listening in real time. Speak naturally in Hindi, Hinglish, or English.";
    }
    return "Tap the central Arc Reactor core to start your real-time voice conversation.";
  };

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col justify-between selection:bg-cyan-500/30">
      {/* Top Bar Contract: 1-row, 3-zone header */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 bg-[#060911]/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#core"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection("core");
          }}
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          J.A.R.V.I.S.
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#core"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection("core");
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeSection === "core" ? "text-cyan-300" : ""
            }`}
          >
            Voice Core
          </a>
          <a
            href="#detective"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection("detective");
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeSection === "detective" ? "text-cyan-300" : ""
            }`}
          >
            Detective Prompts
          </a>
          <a
            href="#actions"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection("actions");
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeSection === "actions" ? "text-cyan-300" : ""
            }`}
          >
            Browser Actions
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTogglePower}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
              state === "disconnected"
                ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                : "bg-rose-500/20 text-rose-200 border border-rose-500/40 hover:bg-rose-500/30"
            }`}
          >
            {state === "disconnected" ? "Connect Voice" : "End Session"}
          </button>
        </div>
      </header>

      {/* Main Responsive Workspace (Mobile single-view or Desktop 12-column full layout) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-4 text-sm text-rose-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="px-3 py-1.5 text-xs font-medium text-rose-200 hover:text-white rounded-lg border border-rose-500/30 whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (Desktop) / Detective & Persona Prompts */}
          <section
            id="detective"
            className={`lg:col-span-4 space-y-6 ${
              activeSection === "detective" ? "block" : "hidden lg:block"
            }`}
          >
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-slate-400">
                  <span>Created by Chandan Sir</span>
                  <span aria-hidden="true" className="mx-1.5">·</span>
                  <span>Avengers & Detective Persona</span>
                </div>
                <h2 className="font-display text-xl font-semibold text-white">
                  01. Intelligence Profile
                </h2>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                Engineered by <strong className="text-white font-semibold">Chandan Sir</strong>, Jarvis combines
                Tony Stark’s warm, effortless wit with a sharp detective mind and a playful, expressive voice.
                Every response is delivered strictly via real-time voice audio.
              </p>

              {/* Voice Timbre Selector */}
              <div className="pt-2 space-y-2">
                <label htmlFor="voice-select" className="block text-xs font-medium text-slate-400">
                  Voice Timbre (Applies on next connection)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICE_OPTIONS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVoice(v.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-colors min-h-[44px] whitespace-nowrap truncate cursor-pointer ${
                        selectedVoice === v.id
                          ? "bg-cyan-500/15 text-cyan-200 border border-cyan-400/50"
                          : "bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instant Voice Test Triggers */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-slate-400">
                  <span>One-Tap Voice Cues</span>
                  <span aria-hidden="true" className="mx-1.5">·</span>
                  <span>24kHz Audio Output</span>
                </div>
                <h2 className="font-display text-xl font-semibold text-white">
                  02. Quick Voice Directives
                </h2>
              </div>

              <p className="text-xs text-slate-400">
                Speak directly into your microphone or tap a directive below to hear Jarvis respond and execute tools immediately.
              </p>

              <div className="divide-y divide-slate-800/80">
                {QUICK_VOICE_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleTriggerCue(item.prompt);
                      setActiveSection("core");
                    }}
                    className="w-full py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-left group cursor-pointer min-h-[56px]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                    <Volume2 className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Center Column: Primary Voice Core Visualizer */}
          <section
            id="core"
            className={`lg:col-span-4 flex flex-col items-center justify-center ${
              activeSection === "core" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center text-center">
              {/* Clean unboxed metadata status */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span className="capitalize text-slate-200 font-medium">{state}</span>
                <span aria-hidden="true">·</span>
                <span>16kHz PCM In / 24kHz Out</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{formatDuration(sessionSeconds)}</span>
              </div>

              <h1
                className="mt-2 font-display text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ textWrap: "balance" }}
              >
                {state === "speaking"
                  ? "Jarvis is Responding"
                  : state === "listening"
                  ? "Listening to Your Voice"
                  : state === "connecting"
                  ? "Initializing Audio Stream"
                  : "Jarvis Voice Assistant"}
              </h1>

              <p className="mt-1.5 text-sm text-slate-400 max-w-xs">{getStateDescription()}</p>

              {/* Central Arc Reactor Visualizer & Mic/Power Button */}
              <JarvisVisualizer
                state={state}
                inputVolume={audioLevels.inputVolume}
                outputVolume={audioLevels.outputVolume}
                bands={audioLevels.bands}
                isMuted={isMuted}
                onTogglePower={handleTogglePower}
              />

              {/* Ergonomic Thumb Controls */}
              <div className="w-full pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePower}
                  className={`flex-1 min-h-[48px] px-5 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    state === "disconnected"
                      ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                      : "bg-rose-500/20 text-rose-200 border border-rose-500/40 hover:bg-rose-500/30"
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{state === "disconnected" ? "Activate Jarvis" : "Disconnect"}</span>
                </button>

                {state !== "disconnected" && (
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    aria-label={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    className={`min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isMuted
                        ? "bg-rose-950/80 border-rose-500/50 text-rose-200"
                        : "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Right Column: Live Function Calling & Detective Action Feed */}
          <section
            id="actions"
            className={`lg:col-span-4 space-y-6 ${
              activeSection === "actions" ? "block" : "hidden lg:block"
            }`}
          >
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">
                    <span>Real-Time Tool Execution</span>
                    <span aria-hidden="true" className="mx-1.5">·</span>
                    <span className="font-mono-num">{actions.length} Executed</span>
                  </div>
                  <h2 className="font-display text-xl font-semibold text-white">
                    03. Live Browser & Detective Log
                  </h2>
                </div>
                {actions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActions([])}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg border border-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {actions.length === 0 ? (
                <div className="py-10 text-center space-y-3 border border-dashed border-slate-800 rounded-xl px-4">
                  <Compass className="w-7 h-7 text-slate-500 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-300">No browser actions executed yet</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Say <span className="text-slate-200">“Jarvis, open YouTube”</span>,{" "}
                      <span className="text-slate-200">“Open GitHub”</span>, or ask a detective question to trigger instant tool calls.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {actions.map((item) => (
                    <div key={item.id} className="py-3.5 first:pt-1 last:pb-1 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800/90 flex items-center justify-center shrink-0 mt-0.5 text-cyan-300">
                        {item.toolName === "openWebsite" && <ExternalLink className="w-4 h-4" />}
                        {item.toolName === "searchTopic" && <Search className="w-4 h-4" />}
                        {item.toolName === "analyzeCaseClue" && <Brain className="w-4 h-4" />}
                        {item.toolName === "setDeviceTimer" && <Timer className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono-num">{item.timestamp}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.toolName}</span>
                          {typeof item.confidenceScore === "number" && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num text-cyan-300">
                                {item.confidenceScore}% certainty
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-sm font-medium text-white mt-0.5">{item.title}</p>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{item.subtitle}</p>

                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                          >
                            <span>Launch {item.url}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (Natural Thumb Zone, <= 15% viewport height) */}
      <nav
        aria-label="Mobile Workspace Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060911]/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-3 items-center h-16 px-2"
      >
        <button
          type="button"
          onClick={() => setActiveSection("core")}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeSection === "core" ? "text-cyan-300" : "text-slate-400"
          }`}
        >
          <Mic className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">Voice Core</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("detective")}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeSection === "detective" ? "text-cyan-300" : "text-slate-400"
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">Persona & Cues</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("actions")}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeSection === "actions" ? "text-cyan-300" : "text-slate-400"
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
            Actions ({actions.length})
          </span>
        </button>
      </nav>
    </div>
  );
}
