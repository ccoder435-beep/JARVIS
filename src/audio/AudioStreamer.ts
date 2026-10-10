/**
 * AudioStreamer handles:
 * 1. Capturing microphone input as raw 16-bit PCM at 16kHz
 * 2. Playing back Gemini Live 24kHz raw 16-bit PCM audio chunks gaplessly
 * 3. Calculating real-time RMS & frequency spectrum levels for smooth visual animations
 * 4. Handling instant interruption (clearing queued audio sources)
 */

export interface AudioLevels {
  inputVolume: number; // 0.0 to 1.0
  outputVolume: number; // 0.0 to 1.0
  bands: number[]; // 24 frequency band magnitudes (0.0 to 1.0)
}

export class AudioStreamer {
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private outputGain: GainNode | null = null;

  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime = 0;
  private isMuted = false;

  private onPcmChunk: (base64Pcm: string) => void;
  private onSpeakingChange: (isSpeaking: boolean) => void;

  constructor(
    onPcmChunk: (base64Pcm: string) => void,
    onSpeakingChange: (isSpeaking: boolean) => void
  ) {
    this.onPcmChunk = onPcmChunk;
    this.onSpeakingChange = onSpeakingChange;
  }

  public async start(): Promise<void> {
    // Initialize 16kHz input AudioContext for mic capture
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.inputCtx = new AudioContextClass({ sampleRate: 16000 });
    // Initialize 24kHz output AudioContext for Gemini Live model playback
    this.outputCtx = new AudioContextClass({ sampleRate: 24000 });

    if (this.inputCtx.state === "suspended") {
      await this.inputCtx.resume();
    }
    if (this.outputCtx.state === "suspended") {
      await this.outputCtx.resume();
    }

    // Output graph: Source -> outputGain -> outputAnalyser -> destination
    this.outputGain = this.outputCtx.createGain();
    this.outputAnalyser = this.outputCtx.createAnalyser();
    this.outputAnalyser.fftSize = 128;
    this.outputAnalyser.smoothingTimeConstant = 0.78;
    this.outputGain.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.outputCtx.destination);

    // Request microphone stream with echo cancellation & noise suppression
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.sourceNode = this.inputCtx.createMediaStreamSource(this.mediaStream);
    this.inputAnalyser = this.inputCtx.createAnalyser();
    this.inputAnalyser.fftSize = 128;
    this.inputAnalyser.smoothingTimeConstant = 0.75;

    this.processorNode = this.inputCtx.createScriptProcessor(2048, 1, 1);

    this.sourceNode.connect(this.inputAnalyser);
    this.inputAnalyser.connect(this.processorNode);
    this.processorNode.connect(this.inputCtx.destination);

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this.isMuted) return;
      const float32Data = event.inputBuffer.getChannelData(0);
      const base64Pcm = this.float32ToBase64Pcm16(float32Data);
      this.onPcmChunk(base64Pcm);
    };
  }

  public enqueueOutputPcm24k(base64Audio: string): void {
    if (!this.outputCtx || !this.outputGain) return;

    if (this.outputCtx.state === "suspended") {
      this.outputCtx.resume().catch(() => {});
    }

    const float32Samples = this.base64Pcm16ToFloat32(base64Audio);
    if (float32Samples.length === 0) return;

    const audioBuffer = this.outputCtx.createBuffer(1, float32Samples.length, 24000);
    audioBuffer.getChannelData(0).set(float32Samples);

    const source = this.outputCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputGain);

    const now = this.outputCtx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.015;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.add(source);
    this.onSpeakingChange(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.onSpeakingChange(false);
      }
    };
  }

  public interruptPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    }
    this.activeSources.clear();
    if (this.outputCtx) {
      this.nextStartTime = this.outputCtx.currentTime;
    }
    this.onSpeakingChange(false);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getAudioLevels(): AudioLevels {
    let inputVolume = 0;
    let outputVolume = 0;
    const bands: number[] = new Array(24).fill(0.06);

    const freqData = new Uint8Array(64);

    if (this.outputAnalyser && this.activeSources.size > 0) {
      this.outputAnalyser.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) {
        sum += freqData[i];
      }
      outputVolume = Math.min(1, sum / (freqData.length * 165));

      for (let b = 0; b < 24; b++) {
        const idx = Math.min(freqData.length - 1, Math.floor((b / 24) * 36));
        bands[b] = Math.max(0.08, freqData[idx] / 255);
      }
    } else if (this.inputAnalyser && !this.isMuted) {
      this.inputAnalyser.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) {
        sum += freqData[i];
      }
      inputVolume = Math.min(1, sum / (freqData.length * 150));

      for (let b = 0; b < 24; b++) {
        const idx = Math.min(freqData.length - 1, Math.floor((b / 24) * 32));
        bands[b] = Math.max(0.06, freqData[idx] / 255);
      }
    }

    return { inputVolume, outputVolume, bands };
  }

  public stop(): void {
    this.interruptPlayback();

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {}
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputCtx) {
      this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }

    if (this.outputCtx) {
      this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
  }

  private float32ToBase64Pcm16(float32Array: Float32Array): string {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    const bytes = new Uint8Array(int16Array.buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private base64Pcm16ToFloat32(base64: string): Float32Array {
    const binary = atob(base64);
    const byteLength = binary.length - (binary.length % 2);
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16View = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16View.length);
    for (let i = 0; i < int16View.length; i++) {
      float32[i] = int16View[i] / 32768.0;
    }
    return float32;
  }
}
