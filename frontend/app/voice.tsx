"use client";

import { Keyboard, Mic, MicOff } from "lucide-react";
import type { VoiceStatus } from "../lib/api";

type VoiceCommandPanelProps = {
  value: string;
  result?: string;
  disabled?: boolean;
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

  return (
    <section>
      <div className="panel-title">
        <h3>Voice Control</h3>
      </div>

      <div className="voice-mode-row">
        <span className={`provider-pill ${speechmaticsReady ? "ready" : "offline"}`}>
          Speechmatics {speechmaticsReady ? "ready" : "not configured"}
        </span>
        <span className="provider-pill ready">Typed command ready</span>
      </div>

      <div className="button-grid">
        <button
          className={`action-button ${isListening ? "danger" : "secondary"}`}
          type="button"
          onClick={isListening ? onStopLive : onStartLive}
          disabled={disabled && !isListening}
          data-testid="speechmatics-button"
        >
          {isListening ? <MicOff size={17} /> : <Mic size={17} />}
          {isListening ? "Stop Live Voice" : "Start Live Speechmatics"}
        </button>
      </div>

      {examples.length ? (
        <div className="voice-command-grid" aria-label="Voice command examples">
          {examples.map((example) => (
            <button
              className="voice-chip"
              type="button"
              key={example}
              onClick={() => onRunCommand?.(example)}
              disabled={disabled}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

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
          Run Command
        </button>
      </div>

      <div className="voice-result">
        {liveTranscript ? <strong>Live transcript: {liveTranscript}</strong> : null}
        <span>{result ?? "Say or type: Analyze repository, Trace LoginButton, Highlight security risks, or Replay execution flow."}</span>
      </div>
    </section>
  );
}
