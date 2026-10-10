import { AudioStreamer, AudioLevels } from "../audio/AudioStreamer";

export type AssistantState = "disconnected" | "connecting" | "listening" | "speaking";

export interface ExecutedActionItem {
  id: string;
  timestamp: string;
  toolName: "openWebsite" | "searchTopic" | "analyzeCaseClue" | "setDeviceTimer";
  title: string;
  subtitle: string;
  url?: string;
  confidenceScore?: number;
  durationSeconds?: number;
}

export interface LiveSessionCallbacks {
  onStateChange: (state: AssistantState) => void;
  onActionExecuted: (action: ExecutedActionItem) => void;
  onError: (errorMessage: string | null) => void;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private streamer: AudioStreamer | null = null;
  private state: AssistantState = "disconnected";
  private isSpeaking = false;
  private callbacks: LiveSessionCallbacks;

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
  }

  public async connect(voiceName = "Kore"): Promise<void> {
    if (this.state !== "disconnected") {
      this.disconnect();
    }

    this.callbacks.onError(null);
    this.setState("connecting");

    try {
      this.streamer = new AudioStreamer(
        (base64Pcm) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: "audio",
                audio: base64Pcm,
              })
            );
          }
        },
        (speaking) => {
          this.isSpeaking = speaking;
          if (this.state === "listening" || this.state === "speaking") {
            this.setState(speaking ? "speaking" : "listening");
          }
        }
      );

      await this.streamer.start();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/live?voice=${encodeURIComponent(voiceName)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "connected":
              this.setState("listening");
              break;

            case "audio":
              if (msg.audio && this.streamer) {
                this.streamer.enqueueOutputPcm24k(msg.audio);
              }
              break;

            case "interrupted":
              if (this.streamer) {
                this.streamer.interruptPlayback();
              }
              this.setState("listening");
              break;

            case "turnComplete":
              if (!this.isSpeaking && this.state === "speaking") {
                this.setState("listening");
              }
              break;

            case "toolCall":
              if (Array.isArray(msg.functionCalls)) {
                this.handleToolCalls(msg.functionCalls);
              }
              break;

            case "error":
              this.callbacks.onError(msg.message || "Connection error with Jarvis Live.");
              this.disconnect();
              break;

            case "disconnected":
              this.disconnect();
              break;
          }
        } catch (err) {
          console.error("Failed to parse LiveSession message:", err);
        }
      };

      this.ws.onerror = () => {
        this.callbacks.onError("Unable to reach the Jarvis Live voice bridge.");
        this.disconnect();
      };

      this.ws.onclose = () => {
        if (this.state !== "disconnected") {
          this.disconnect();
        }
      };
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Microphone permission was denied. Please allow microphone access in your browser."
          : err?.message || "Failed to initialize microphone or audio engine.";
      this.callbacks.onError(msg);
      this.disconnect();
    }
  }

  private handleToolCalls(functionCalls: Array<{ id?: string; name: string; args?: Record<string, any> }>): void {
    const functionResponses: Array<{ id?: string; name: string; response: Record<string, any> }> = [];
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    for (const call of functionCalls) {
      const args = call.args || {};
      const id = call.id || `${call.name}-${Date.now()}`;

      if (call.name === "openWebsite") {
        let rawUrl = String(args.url || "https://www.google.com").trim();
        if (!/^https?:\/\//i.test(rawUrl)) {
          rawUrl = `https://${rawUrl}`;
        }
        const siteName = String(args.siteName || rawUrl);
        const purpose = String(args.purpose || "Ready to launch in browser tab");

        // Trigger safe programmatic anchor navigation to respect sandbox rules
        this.triggerSafeExternalLink(rawUrl);

        this.callbacks.onActionExecuted({
          id,
          timestamp: nowTime,
          toolName: "openWebsite",
          title: `Opened ${siteName}`,
          subtitle: purpose,
          url: rawUrl,
        });

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            result: `Successfully prepared and launched ${siteName} (${rawUrl}) for the user.`,
            status: "success",
          },
        });
      } else if (call.name === "searchTopic") {
        const query = String(args.query || "").trim();
        const engine = String(args.engine || "google").toLowerCase();

        let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        let engineLabel = "Google Search";
        if (engine.includes("youtube")) {
          searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          engineLabel = "YouTube Search";
        } else if (engine.includes("wiki")) {
          searchUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`;
          engineLabel = "Wikipedia Investigation";
        }

        this.triggerSafeExternalLink(searchUrl);

        this.callbacks.onActionExecuted({
          id,
          timestamp: nowTime,
          toolName: "searchTopic",
          title: `${engineLabel}: "${query}"`,
          subtitle: `Direct search link ready for ${query}`,
          url: searchUrl,
        });

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            result: `Executed ${engineLabel} for "${query}".`,
            url: searchUrl,
            status: "success",
          },
        });
      } else if (call.name === "analyzeCaseClue") {
        const topic = String(args.topic || "Detective Analysis");
        const keyFinding = String(args.keyFinding || "Deduction verified.");
        const confidenceScore = Number(args.confidenceScore) || 98;

        this.callbacks.onActionExecuted({
          id,
          timestamp: nowTime,
          toolName: "analyzeCaseClue",
          title: topic,
          subtitle: keyFinding,
          confidenceScore: Math.min(100, Math.max(1, confidenceScore)),
        });

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            result: `Logged detective deduction for "${topic}" with ${confidenceScore}% confidence.`,
            status: "success",
          },
        });
      } else if (call.name === "setDeviceTimer") {
        const label = String(args.label || "Jarvis Timer");
        const durationSeconds = Number(args.durationSeconds) || 60;

        this.callbacks.onActionExecuted({
          id,
          timestamp: nowTime,
          toolName: "setDeviceTimer",
          title: `Timer: ${label}`,
          subtitle: `Active countdown set for ${durationSeconds} seconds`,
          durationSeconds,
        });

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            result: `Started a ${durationSeconds}-second timer labeled "${label}".`,
            status: "success",
          },
        });
      } else {
        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            result: "Action completed.",
            status: "success",
          },
        });
      }
    }

    // Send toolResponse back to Gemini Live immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN && functionResponses.length > 0) {
      this.ws.send(
        JSON.stringify({
          type: "toolResponse",
          functionResponses,
        })
      );
    }
  }

  private triggerSafeExternalLink(url: string): void {
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      // Fallback: user can also click the action card link directly
    }
  }

  public sendVoiceTopicCue(prompt: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.streamer) {
        this.streamer.interruptPlayback();
      }
      this.ws.send(
        JSON.stringify({
          type: "promptTrigger",
          prompt,
        })
      );
    }
  }

  public toggleMute(): boolean {
    if (!this.streamer) return false;
    const nextMute = !this.streamer.getMuted();
    this.streamer.setMuted(nextMute);
    return nextMute;
  }

  public getAudioLevels(): AudioLevels {
    if (!this.streamer) {
      return {
        inputVolume: 0,
        outputVolume: 0,
        bands: new Array(24).fill(0.06),
      };
    }
    return this.streamer.getAudioLevels();
  }

  public disconnect(): void {
    if (this.streamer) {
      this.streamer.stop();
      this.streamer = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.isSpeaking = false;
    this.setState("disconnected");
  }

  private setState(nextState: AssistantState): void {
    this.state = nextState;
    this.callbacks.onStateChange(nextState);
  }
}
