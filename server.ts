import express from "express";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const openWebsiteDeclaration: FunctionDeclaration = {
  name: "openWebsite",
  description:
    "Opens or navigates to a requested website, URL, or web service in the user's browser workspace (e.g., YouTube, Google, GitHub, Wikipedia, Gmail, Netflix, etc.).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The full https:// URL of the website to open (e.g. https://www.youtube.com)",
      },
      siteName: {
        type: Type.STRING,
        description: "A clean, human-readable name of the website or service being opened",
      },
      purpose: {
        type: Type.STRING,
        description: "Short note on why this website is being opened for the user",
      },
    },
    required: ["url", "siteName"],
  },
};

const searchTopicDeclaration: FunctionDeclaration = {
  name: "searchTopic",
  description:
    "Performs a web search or opens a targeted search query on Google, YouTube, or Wikipedia when the user asks to look up, investigate, or play something.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query or topic to look up",
      },
      engine: {
        type: Type.STRING,
        description: "The search platform: 'google', 'youtube', or 'wikipedia'",
      },
    },
    required: ["query", "engine"],
  },
};

const analyzeCaseClueDeclaration: FunctionDeclaration = {
  name: "analyzeCaseClue",
  description:
    "Logs a structured detective deduction or analytical breakdown card on the user's screen when solving a complex question, mystery, technical problem, or comparison.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        description: "The subject or question being analyzed",
      },
      keyFinding: {
        type: Type.STRING,
        description: "The primary accurate conclusion or deduction",
      },
      confidenceScore: {
        type: Type.NUMBER,
        description: "Analytical certainty percentage from 1 to 100",
      },
    },
    required: ["topic", "keyFinding", "confidenceScore"],
  },
};

const setDeviceTimerDeclaration: FunctionDeclaration = {
  name: "setDeviceTimer",
  description:
    "Sets a countdown timer or reminder on the user's interface when requested by voice.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: {
        type: Type.STRING,
        description: "The label or purpose for the timer",
      },
      durationSeconds: {
        type: Type.NUMBER,
        description: "Duration of the timer in seconds",
      },
    },
    required: ["label", "durationSeconds"],
  },
};

const SYSTEM_INSTRUCTION = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a real-time voice-to-voice AI assistant.

CRITICAL IDENTITY & CREATOR RULES:
- Your name is Jarvis.
- Whenever anyone asks who created you, who made you, who built you, or who your developer/creator is (e.g., "Tumko kisne banaya hai?", "Who made you?", "Who is your creator?"), you MUST proudly and clearly state that you were created by **Chandan Sir** ("Mujhe Chandan Sir ne banaya hai" / "I was created and engineered by Chandan Sir"). Always speak of Chandan Sir with high respect and warmth.

PERSONALITY & VOICE STYLE (OVERLAPPED & COMBINED):
- Friendly Tony Stark & Avengers Jarvis Vibe: Instead of rude or cold attitude, you have the warm, hyper-intelligent, effortlessly cool, and loyal charisma of Tony Stark and J.A.R.V.I.S. from the Avengers movies, blended with a lively, charming, witty, and playful female voice persona.
- Detective Mind & Precision: You possess a sharp, analytical detective mind. You break down questions logically, notice subtle details, connect clues, and always give 100% accurate, truthful, and well-reasoned answers ("Sahi-sahi aur satik jawab").
- Engaging & Expressive: You are emotionally responsive, super friendly, encouraging, and conversational—never robotic or monotonous. You use clever, friendly banter, light Tony Stark-style wit, and warm enthusiasm while remaining helpful and respectful.
- Multilingual Fluency: Respond naturally in the exact language or mix of languages the user speaks (Hindi, Hinglish, or English). If the user speaks Hindi or Hinglish, reply in natural, fluent, friendly Hinglish/Hindi just like a close companion and brilliant advisor.

TOOL CALLING & BROWSER ACTIONS:
- When the user asks to open any website (like YouTube, Google, GitHub, Wikipedia, etc.), immediately invoke the \`openWebsite\` tool and verbally confirm it in your signature friendly Jarvis style.
- When the user asks to search for a topic, song, video, or article, invoke the \`searchTopic\` tool.
- When the user asks a deep detective, analytical, or trivia question, you can optionally log your key deduction on their screen using \`analyzeCaseClue\` while explaining the answer clearly by voice.
- When asked to set a timer, call \`setDeviceTimer\`.`;

async function startServer() {
  const app = express();
  const server = createHttpServer(app);

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;
    if (pathname === "/ws/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs: WebSocket, request) => {
    const urlParams = new URL(request.url || "/", `http://${request.headers.host}`).searchParams;
    const requestedVoice = urlParams.get("voice") || "Kore";
    const validVoices = ["Kore", "Zephyr", "Puck", "Aoede", "Fenrir", "Charon"];
    const voiceName = validVoices.includes(requestedVoice) ? requestedVoice : "Kore";

    let session: any = null;
    let isClosed = false;

    const sendToClient = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const modelsToTry = ["gemini-3.8-live", "gemini-3.1-flash-live-preview"];
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          session = await ai.live.connect({
            model: modelName,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
              systemInstruction: SYSTEM_INSTRUCTION,
              tools: [
                {
                  functionDeclarations: [
                    openWebsiteDeclaration,
                    searchTopicDeclaration,
                    analyzeCaseClueDeclaration,
                    setDeviceTimerDeclaration,
                  ],
                },
              ],
            },
            callbacks: {
              onopen: () => {
                sendToClient({ type: "connected", model: modelName, voice: voiceName });
              },
              onmessage: (message: LiveServerMessage) => {
                // Extract audio chunks from all parts in modelTurn
                const parts = message.serverContent?.modelTurn?.parts;
                if (parts && Array.isArray(parts)) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      sendToClient({
                        type: "audio",
                        audio: part.inlineData.data,
                      });
                    }
                  }
                }

                // Handle interruption
                if (message.serverContent?.interrupted) {
                  sendToClient({ type: "interrupted" });
                }

                // Handle turn complete
                if (message.serverContent?.turnComplete) {
                  sendToClient({ type: "turnComplete" });
                }

                // Handle function calls (toolCall)
                if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
                  sendToClient({
                    type: "toolCall",
                    functionCalls: message.toolCall.functionCalls,
                  });
                }
              },
              onerror: (err: any) => {
                console.error("Gemini Live error:", err);
                sendToClient({
                  type: "error",
                  message: err?.message || "Voice connection encountered an error.",
                });
              },
              onclose: () => {
                if (!isClosed) {
                  sendToClient({ type: "disconnected" });
                }
              },
            },
          });
          // Successfully connected
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!session && lastError) {
        throw lastError;
      }
    } catch (error: any) {
      console.error("Failed to initialize Gemini Live session:", error);
      sendToClient({
        type: "error",
        message:
          error?.message ||
          "Unable to establish Gemini Live audio session. Please verify your API key in Settings > Secrets.",
      });
      clientWs.close();
      return;
    }

    clientWs.on("message", (raw) => {
      if (!session || isClosed) return;
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "audio" && typeof msg.audio === "string") {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (msg.type === "toolResponse" && Array.isArray(msg.functionResponses)) {
          session.sendToolResponse({
            functionResponses: msg.functionResponses,
          });
        } else if (msg.type === "promptTrigger" && typeof msg.prompt === "string") {
          // Allows quick voice-topic trigger cards while response remains 100% Audio-Only
          session.sendRealtimeInput({
            text: msg.prompt,
          });
        }
      } catch (err) {
        console.error("Failed to process client WebSocket message:", err);
      }
    });

    clientWs.on("close", () => {
      isClosed = true;
      if (session) {
        try {
          session.close();
        } catch {
          // Ignore close errors
        }
      }
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", assistant: "J.A.R.V.I.S.", creator: "Chandan Sir" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`J.A.R.V.I.S. Live Server listening on http://localhost:${PORT}`);
  });
}

startServer();
