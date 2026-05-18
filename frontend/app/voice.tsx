"use client";

import { Keyboard, Mic, MicOff } from "lucide-react";
import type { VoiceStatus } from "../lib/api";

type VoiceCommandPanelProps = {
  value: string;
  result?: string;
  disabled?: boolean;
  variant?: "panel" | "compact";
  isListening: boolean;
  liveTranscript?: string;
  voiceStatus?: VoiceStatus;
  examples?: string[];
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRunCommand?: (value: string) => void;
  onStartLive: () => void;
  onStopLive: () => void;
};

export function VoiceCommandPanel({
  value,
  result,
  disabled,
  variant = "panel",
  isListening,
  liveTranscript,
  voiceStatus,
  examples = [],
  onChange,
  onSubmit,
  onRunCommand,
  onStartLive,
  onStopLive
}: VoiceCommandPanelProps) {
  const speechmaticsReady = Boolean(voiceStatus?.speechmatics_configured);
  const compact = variant === "compact";

  return (
    <section className={`voice-control${compact ? " compact" : ""}`}>
      <div className={compact ? "voice-control-line voice-control-primary" : "panel-title"}>
        <h3>Voice Control</h3>

        <div className="voice-mode-row">
          <span className={`provider-pill ${speechmaticsReady ? "ready" : "offline"}`}>
            Speechmatics {speechmaticsReady ? "ready" : "not configured"}
          </span>
          <span className="provider-pill ready">Typed command ready</span>
        </div>

        <button
          className={`action-button voice-live-button ${isListening ? "danger" : "secondary"}`}
          type="button"
          onClick={isListening ? onStopLive : onStartLive}
          disabled={disabled && !isListening}
          data-testid="speechmatics-button"
        >
          {isListening ? <MicOff size={17} /> : <Mic size={17} />}
          {isListening
            ? compact ? "Stop Voice" : "Stop Live Voice"
            : compact ? "Live Speechmatics" : "Start Live Speechmatics"}
        </button>

        {compact ? (
          <VoiceResult
            liveTranscript={liveTranscript}
            result={result}
          />
        ) : null}
      </div>

      <div className={compact ? "voice-control-line voice-control-secondary" : ""}>
        {examples.length ? (
          <div className="voice-command-grid" aria-label="Voice command examples">
            {examples.map((example) => (
              <button
                className="voice-chip"
              type="button"
              key={example}
              aria-label={example}
              title={example}
              onClick={() => onRunCommand?.(example)}
              disabled={disabled}
            >
              {compact ? compactCommandLabel(example) : example}
            </button>
          ))}
        </div>
      ) : null}

        <VoiceInput compact={compact} value={value} disabled={disabled} onChange={onChange} onSubmit={onSubmit} />

        {!compact ? <VoiceResult liveTranscript={liveTranscript} result={result} /> : null}
      </div>
    </section>
  );
}

type VoiceInputProps = {
  value: string;
  disabled?: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

function VoiceInput({ value, disabled, compact, onChange, onSubmit }: VoiceInputProps) {
  return (
    <div className="voice-row">
      <input
        aria-label="Voice command text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit();
          }
        }}
      />
      <button className="action-button secondary" type="button" onClick={onSubmit} disabled={disabled} data-testid="voice-button">
        <Keyboard size={17} />
        {compact ? "Run" : "Run Command"}
      </button>
    </div>
  );
}

type VoiceResultProps = {
  liveTranscript?: string;
  result?: string;
};

function VoiceResult({ liveTranscript, result }: VoiceResultProps) {
  return (
    <div className="voice-result">
      {liveTranscript ? <strong>Live transcript: {liveTranscript}</strong> : null}
      <span>{result ?? "Say or type a TraceGrid command."}</span>
    </div>
  );
}

function compactCommandLabel(command: string) {
  const normalized = command.toLowerCase();

  if (normalized.includes("analyze")) {
    return "Analyze";
  }

  if (normalized.includes("security")) {
    return "Security";
  }

  if (normalized.includes("replay")) {
    return "Replay";
  }

  return "Trace";
}
