import type { AgentOutput, AgentResults } from "../lib/api";

type AgentsProps = {
  data: AgentResults;
};

export default function Agents({ data }: AgentsProps) {
  const cards: AgentOutput[] = [
    data.architecture,
    data.security,
    data.execution,
    data.explainer
  ];

  return (
    <div className="agent-grid">
      {cards.map((agent) => (
        <section className="agent-card" key={agent.role}>
          <h4>{agent.role}</h4>
          <small>
            {agent.llm_status === "live"
              ? `Live ${agent.llm_provider} inference: ${agent.llm_model}`
              : agent.grounding}
          </small>
          <p>{agent.verdict}</p>
          {agent.llm_output ? <p>{agent.llm_output}</p> : null}
          {agent.signals?.length ? (
            <ul className="finding-list">
              {agent.signals.map((signal) => (
                <li className="info" key={signal}>{signal}</li>
              ))}
            </ul>
          ) : null}
          {agent.steps?.length ? (
            <ol className="agent-steps">
              {agent.steps.slice(0, 6).map((step, index) => (
                <li key={`${agent.role}-step-${index}`}>
                  <strong>{String(step.label ?? `Step ${index + 1}`)}</strong>
                  <span>
                    {String(step.layer ?? "Layer unknown")}
                    {step.effect ? ` - ${String(step.effect)}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {agent.findings?.length ? (
            <ul className="finding-list">
              {agent.findings.slice(0, 4).map((finding, index) => (
                <li className={finding.severity ?? "info"} key={`${finding.node}-${index}`}>
                  <strong>{finding.node}</strong>: {finding.recommendation}
                </li>
              ))}
            </ul>
          ) : null}
          {agent.narrative ? <p>{agent.narrative}</p> : null}
          {agent.path?.length ? <small>Path: {agent.path.join(" -> ")}</small> : null}
        </section>
      ))}
    </div>
  );
}
