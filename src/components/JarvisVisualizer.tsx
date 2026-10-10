import React from "react";
import { Mic, MicOff, Loader2, Volume2, Power } from "lucide-react";
import { AssistantState } from "../session/LiveSession";

interface JarvisVisualizerProps {
  state: AssistantState;
  inputVolume: number;
  outputVolume: number;
  bands: number[];
  isMuted: boolean;
  onTogglePower: () => void;
}

export const JarvisVisualizer: React.FC<JarvisVisualizerProps> = ({
  state,
  inputVolume,
  outputVolume,
  bands,
  isMuted,
  onTogglePower,
}) => {
  const isConnected = state !== "disconnected";
  const activeEnergy = state === "speaking" ? outputVolume : state === "listening" ? inputVolume : 0;

  // Dynamic compositor scale based on live voice energy
  const coreScale = 1 + Math.min(0.28, activeEnergy * 0.45);
  const outerRingScale = 1 + Math.min(0.35, activeEnergy * 0.55);

  const getRingAccentColor = () => {
    if (state === "speaking") return "rgba(34, 211, 238, 0.75)"; // Cyan arc reactor glow
    if (state === "listening") return isMuted ? "rgba(244, 63, 94, 0.5)" : "rgba(56, 189, 248, 0.55)";
    if (state === "connecting") return "rgba(251, 191, 36, 0.6)"; // Warm Stark gold connecting
    return "rgba(148, 163, 184, 0.2)";
  };

  return (
    <div className="relative flex flex-col items-center justify-center py-6 select-none">
      {/* Ambient Radial Glow */}
      <div
        className="pointer-events-none absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl transition-opacity duration-300"
        style={{
          background:
            state === "speaking"
              ? "radial-gradient(circle, rgba(6,182,212,0.32) 0%, rgba(14,116,144,0.08) 60%, transparent 100%)"
              : state === "listening"
              ? "radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(3,105,161,0.05) 60%, transparent 100%)"
              : state === "connecting"
              ? "radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(30,41,59,0.25) 0%, transparent 70%)",
          transform: `scale(${outerRingScale})`,
        }}
      />

      {/* Arc Reactor Geometry SVG & Interactive Core */}
      <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
        <svg
          viewBox="0 0 260 260"
          className="pointer-events-none absolute inset-0 w-full h-full"
          style={{
            transform: `scale(${outerRingScale})`,
            transition: "transform 120ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Outer precision degree ring */}
          <circle
            cx="130"
            cy="130"
            r="120"
            fill="none"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="1"
            strokeDasharray="3 6"
          />

          {/* Secondary rotating Stark HUD ring */}
          <circle
            cx="130"
            cy="130"
            r="106"
            fill="none"
            stroke={getRingAccentColor()}
            strokeWidth="1.5"
            strokeDasharray="28 14 8 14"
            className={isConnected ? "origin-center animate-[spin_18s_linear_infinite]" : "origin-center"}
          />

          {/* Counter-rotating inner tactical ring */}
          <circle
            cx="130"
            cy="130"
            r="92"
            fill="none"
            stroke={
              state === "speaking"
                ? "rgba(103, 232, 249, 0.65)"
                : state === "listening"
                ? "rgba(56, 189, 248, 0.35)"
                : "rgba(148, 163, 184, 0.12)"
            }
            strokeWidth="1.25"
            strokeDasharray="12 20"
            className={isConnected ? "origin-center animate-[spin_12s_linear_infinite_reverse]" : "origin-center"}
          />

          {/* Radial Spectrum Bars around the Core */}
          {bands.map((level, index) => {
            const angle = (index / bands.length) * Math.PI * 2 - Math.PI / 2;
            const innerRadius = 72;
            const barLength = isConnected ? 6 + level * 26 : 4;
            const x1 = 130 + Math.cos(angle) * innerRadius;
            const y1 = 130 + Math.sin(angle) * innerRadius;
            const x2 = 130 + Math.cos(angle) * (innerRadius + barLength);
            const y2 = 130 + Math.sin(angle) * (innerRadius + barLength);

            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  state === "speaking"
                    ? "#22d3ee"
                    : state === "listening"
                    ? isMuted
                      ? "#f43f5e"
                      : "#38bdf8"
                    : state === "connecting"
                    ? "#fbbf24"
                    : "rgba(148, 163, 184, 0.25)"
                }
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Central Power / Microphone Button (Touch Target >= 128px) */}
        <button
          type="button"
          onClick={onTogglePower}
          aria-label={isConnected ? "Disconnect Jarvis Voice Session" : "Start Jarvis Voice Session"}
          style={{
            transform: `scale(${coreScale})`,
            transition: "transform 110ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className={`relative z-10 w-32 h-32 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors duration-200 ${
            state === "speaking"
              ? "bg-cyan-950/90 border-2 border-cyan-300 shadow-[0_0_45px_rgba(34,211,238,0.45)] text-cyan-100"
              : state === "listening"
              ? isMuted
                ? "bg-rose-950/80 border-2 border-rose-400/70 text-rose-100"
                : "bg-sky-950/85 border-2 border-sky-400/80 shadow-[0_0_30px_rgba(56,189,248,0.3)] text-sky-100"
              : state === "connecting"
              ? "bg-amber-950/80 border-2 border-amber-400/80 text-amber-100"
              : "bg-slate-900/90 border border-slate-700 hover:border-cyan-400/60 text-slate-200 hover:text-white"
          }`}
        >
          {state === "connecting" ? (
            <Loader2 className="w-9 h-9 text-amber-300 animate-spin" />
          ) : state === "speaking" ? (
            <Volume2 className="w-10 h-10 text-cyan-300" />
          ) : state === "listening" ? (
            isMuted ? (
              <MicOff className="w-9 h-9 text-rose-300" />
            ) : (
              <Mic className="w-9 h-9 text-sky-300" />
            )
          ) : (
            <Power className="w-9 h-9 text-cyan-400" />
          )}

          <span className="font-display text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
            {state === "disconnected"
              ? "Start Jarvis"
              : state === "connecting"
              ? "Connecting"
              : state === "speaking"
              ? "Speaking"
              : isMuted
              ? "Mic Muted"
              : "Listening"}
          </span>
        </button>
      </div>

      {/* Horizontal Real-Time Audio Waveform Strip */}
      <div className="mt-4 h-10 flex items-center justify-center gap-1.5 px-4">
        {bands.slice(0, 20).map((val, idx) => {
          const heightPx = isConnected ? Math.max(4, Math.round(val * 36)) : 4;
          return (
            <div
              key={idx}
              className="w-1 rounded-full transition-transform duration-75"
              style={{
                height: "36px",
                transform: `scaleY(${heightPx / 36})`,
                backgroundColor:
                  state === "speaking"
                    ? "#22d3ee"
                    : state === "listening"
                    ? isMuted
                      ? "#fb7185"
                      : "#38bdf8"
                    : "rgba(100, 116, 139, 0.35)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
