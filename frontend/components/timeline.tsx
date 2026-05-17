import type { TimelineStep } from "../lib/api";

type TimelineProps = {
  data: TimelineStep[];
  activeIndex: number;
};

export default function Timeline({ data, activeIndex }: TimelineProps) {
  return (
    <div className="timeline">
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
