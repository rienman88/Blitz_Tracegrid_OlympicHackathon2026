"use client";

import { Pause, Play, RefreshCw } from "lucide-react";

type ReplayControlsProps = {
  isPlaying: boolean;
  onReplay: () => void;
  onReset: () => void;
};

export function ReplayControls({ isPlaying, onReplay, onReset }: ReplayControlsProps) {
  return (
    <div className="replay-controls">
      <button className="action-button secondary" type="button" onClick={onReplay} data-testid="replay-button">
        {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        Replay Flow
      </button>
      <button className="action-button secondary" type="button" onClick={onReset}>
        <RefreshCw size={17} />
        Reset
      </button>
    </div>
  );
}
