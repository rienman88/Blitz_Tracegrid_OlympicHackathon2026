import type { TimelineStep } from "../lib/api";

type TimelineProps = {
  data: TimelineStep[];
  activeIndex: number;
};

export default function Timeline({ data, activeIndex }: TimelineProps) {
  return (
    <div className="timeline">
      <div className="brief-explanation">
        <strong>Brief explanation</strong>
        <span>
          {data.length
            ? "This is the simplified story of what TraceGrid believes happens next. Each row is one step in the replay path selected from the graph."
            : "No replay path is selected yet. Run a trace or AI Investigation to turn the graph into a step-by-step story."}
        </span>
      </div>
      {data.map((t, i) => (
        <div className={`timeline-step${i <= activeIndex ? " active" : ""}`} key={t.node_id}>
          <div className="timeline-index">{i + 1}</div>
          <div>
            <strong>{t.label}</strong>
            <span>{t.phase}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
