"use client";

import { edgeId, type TraceGraph, type TraceNode } from "../lib/api";

type GraphProps = {
  data: TraceGraph;
  revealCount: number;
  activeNodeIds: string[];
  activeEdgeIds: string[];
  selectedNodeId?: string;
  onNodeSelect: (node: TraceNode) => void;
};

const MIN_NODE_WIDTH = 150;
const MAX_NODE_WIDTH = 206;
const NODE_HEIGHT = 76;
const VIEW_PADDING = 72;
const COLUMN_GAP = 58;
const ROW_GAP = 96;
const MAX_COLUMNS = 4;
const DEFAULT_VIEW_BOX = "0 0 1040 560";

type PositionedTraceNode = TraceNode & {
  width: number;
  height: number;
  x: number;
  y: number;
};

type Point = {
  x: number;
  y: number;
};

type EdgeRoute = {
  path: string;
  label: Point;
};

export default function Graph({
  data,
  revealCount,
  activeNodeIds,
  activeEdgeIds,
  selectedNodeId,
  onNodeSelect
}: GraphProps) {
  const layoutNodes = layoutGraph(data.nodes);
  const visibleNodes = layoutNodes.slice(0, Math.min(revealCount, layoutNodes.length));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const activeNodes = new Set(activeNodeIds);
  const activeEdges = new Set(activeEdgeIds);
  const nodeById = new Map(layoutNodes.map((node) => [node.id, node]));
  const graphBounds = visibleNodes.length > 0 ? boundsFor(layoutNodes) : DEFAULT_VIEW_BOX;
  const selected = visibleNodes.find((node) => node.id === selectedNodeId) ?? visibleNodes[0];

  return (
    <div className="graph-wrap">
      <svg className="trace-graph" viewBox={graphBounds} preserveAspectRatio="xMidYMid meet" role="img" aria-label="TraceGrid execution graph">
        <defs>
          <marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0 0 L 12 6 L 0 12 z" fill="#41524a" />
          </marker>
          <marker id="arrow-active" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0 0 L 12 6 L 0 12 z" fill="#22c55e" />
          </marker>
        </defs>

        {data.edges
          .filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
          .map((edge) => {
            const source = nodeById.get(edge.from);
            const target = nodeById.get(edge.to);

            if (!source || !target) {
              return null;
            }

            const active = activeEdges.has(edgeId(edge));
            const route = routeEdge(source, target);

            return (
              <g key={edgeId(edge)}>
                <path
                  className={`edge-path${active ? " active" : ""}`}
                  d={route.path}
                  markerEnd={active ? "url(#arrow-active)" : "url(#arrow)"}
                />
                {edge.label ? (
                  <text className="edge-label" x={route.label.x} y={route.label.y}>
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}

        {visibleNodes.map((node) => {
          const active = activeNodes.has(node.id);
          const selectedNode = selectedNodeId === node.id;
          const risk = node.risk ?? "none";
          const nodeBox = nodeById.get(node.id);
          if (!nodeBox) {
            return null;
          }
          const labelLines = splitLabel(node.label, Math.floor((nodeBox.width - 24) / 7));

          return (
            <g
              key={node.id}
              className={`node-shell risk-${risk}${active ? " active" : ""}${selectedNode ? " selected" : ""}`}
              transform={`translate(${nodeBox.x}, ${nodeBox.y})`}
              role="button"
              tabIndex={0}
              aria-label={node.label}
              onClick={() => onNodeSelect(node)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onNodeSelect(node);
                }
              }}
            >
              <rect className="node-rect" width={nodeBox.width} height={nodeBox.height} rx="8" />
              <text className="node-label" x="12" y="24">
                {labelLines.map((line, index) => (
                  <tspan key={`${node.id}-${index}`} x="12" dy={index === 0 ? 0 : 15}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text className="node-layer" x="12" y="58">
                {node.layer}
              </text>
              <text className={`node-risk ${risk}`} x={Math.max(92, nodeBox.width - 48)} y="58">
                {risk}
              </text>
            </g>
          );
        })}
      </svg>

      {selected ? (
        <div className="selected-node">
          <strong>{selected.label}</strong>
          <p>{selected.description}</p>
          <div className={`risk-explanation risk-${selected.risk ?? "none"}`}>
            <span>Risk reasoning</span>
            <strong>{riskReason(selected, data)}</strong>
            <p className="brief-explanation inline">
              <strong>Brief explanation</strong>
              <span>{riskBrief(selected)}</span>
            </p>
          </div>
          <div className="evidence-row">
            <span>{formatConfidence(selected.confidence ?? selected.evidence?.confidence)}</span>
            {selected.evidence ? (
              <code>{selected.evidence.file}:{selected.evidence.line}</code>
            ) : (
              <code>fallback evidence</code>
            )}
            <span>{selected.evidence?.detector ?? "demo/static"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function layoutGraph(nodes: TraceNode[]): PositionedTraceNode[] {
  if (!nodes.length) {
    return [];
  }

  const columns = Math.min(MAX_COLUMNS, Math.max(1, nodes.length));
  const base = nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const rawColumn = index % columns;
    const column = row % 2 === 0 ? rawColumn : columns - 1 - rawColumn;

    return {
      node,
      row,
      column,
      width: nodeWidth(node.label)
    };
  });
  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(MIN_NODE_WIDTH, ...base.filter((item) => item.column === column).map((item) => item.width))
  );
  const columnOffsets = columnWidths.reduce<number[]>((offsets, width, index) => {
    const previous = index === 0 ? VIEW_PADDING : offsets[index - 1] + columnWidths[index - 1] + COLUMN_GAP;
    offsets.push(previous);
    return offsets;
  }, []);

  return base.map(({ node, row, column, width }) => ({
    ...node,
    width,
    height: NODE_HEIGHT,
    x: columnOffsets[column],
    y: VIEW_PADDING + row * (NODE_HEIGHT + ROW_GAP)
  }));
}

function routeEdge(source: PositionedTraceNode, target: PositionedTraceNode): EdgeRoute {
  const sourceCenter = centerOf(source);
  const targetCenter = centerOf(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dy) > Math.abs(dx) * 0.82) {
    const downward = dy >= 0;
    const start = {
      x: sourceCenter.x,
      y: downward ? source.y + source.height : source.y
    };
    const end = {
      x: targetCenter.x,
      y: downward ? target.y : target.y + target.height
    };
    const bend = Math.max(48, Math.abs(end.y - start.y) * 0.44);
    const firstControlY = start.y + (downward ? bend : -bend);
    const secondControlY = end.y - (downward ? bend : -bend);

    return {
      path: `M ${start.x} ${start.y} C ${start.x} ${firstControlY}, ${end.x} ${secondControlY}, ${end.x} ${end.y}`,
      label: {
        x: (start.x + end.x) / 2 + 22,
        y: (start.y + end.y) / 2
      }
    };
  }

  const rightward = dx >= 0;
  const start = {
    x: rightward ? source.x + source.width : source.x,
    y: sourceCenter.y
  };
  const end = {
    x: rightward ? target.x : target.x + target.width,
    y: targetCenter.y
  };
  const bend = Math.max(42, Math.abs(end.x - start.x) * 0.44);
  const firstControlX = start.x + (rightward ? bend : -bend);
  const secondControlX = end.x - (rightward ? bend : -bend);

  return {
    path: `M ${start.x} ${start.y} C ${firstControlX} ${start.y}, ${secondControlX} ${end.y}, ${end.x} ${end.y}`,
    label: {
      x: (start.x + end.x) / 2,
      y: Math.min(start.y, end.y) - 12
    }
  };
}

function centerOf(node: PositionedTraceNode): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  };
}

function nodeWidth(label: string) {
  const longestToken = label.split(/[\s/\\.-]+/).reduce((max, token) => Math.max(max, token.length), 0);
  const estimated = Math.max(label.length * 5.4 + 34, longestToken * 8.2 + 34);
  return Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, Math.ceil(estimated)));
}

function boundsFor(nodes: PositionedTraceNode[]) {
  if (!nodes.length) {
    return DEFAULT_VIEW_BOX;
  }

  const left = Math.min(...nodes.map((node) => node.x)) - VIEW_PADDING;
  const top = Math.min(...nodes.map((node) => node.y)) - VIEW_PADDING;
  const right = Math.max(...nodes.map((node) => node.x + node.width)) + VIEW_PADDING;
  const bottom = Math.max(...nodes.map((node) => node.y + node.height)) + VIEW_PADDING;
  const width = Math.max(560, right - left);
  const height = Math.max(420, bottom - top);

  return `${left} ${top} ${width} ${height}`;
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== "number") {
    return "demo fixture";
  }

  return `${Math.round(confidence * 100)}% confidence`;
}

function riskReason(node: TraceNode, graph: TraceGraph) {
  const risk = node.risk ?? "none";
  const degree = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length;
  const boundary = boundaryReason(node);

  if (risk === "high") {
    return `${boundary} is high risk because it is exposed, sensitive, or close to auth/data flow with ${degree} visible graph connection${degree === 1 ? "" : "s"}.`;
  }

  if (risk === "medium") {
    return `${boundary} is medium risk because it changes trust, state, identity, session, or backend control flow.`;
  }

  if (risk === "low") {
    return `${boundary} is low risk: it is likely local control flow, but still contributes to the replay path.`;
  }

  return `${boundary} has no current risk signal in AST-lite evidence; that is not proof of runtime safety.`;
}

function riskBrief(node: TraceNode) {
  const risk = node.risk ?? "none";

  if (risk === "high") {
    return "TraceGrid is saying this node deserves immediate attention because it is close to something exposed, sensitive, or security-related.";
  }

  if (risk === "medium") {
    return "TraceGrid is saying this node changes something important, so it should be checked before calling the flow safe.";
  }

  if (risk === "low") {
    return "TraceGrid found a small signal here. It matters to the path, but it is not the main concern.";
  }

  return "This part looks important only because of where it sits in the graph. TraceGrid did not find an obvious danger here, but runtime testing is still needed before calling it safe.";
}

function boundaryReason(node: TraceNode) {
  const type = node.type.toLowerCase();
  const label = node.label.toLowerCase();

  if (["api", "route", "endpoint"].includes(type) || /^get |^post |^put |^delete |\/api\//i.test(node.label)) {
    return "API or network boundary";
  }

  if (type === "middleware" || node.layer.toLowerCase() === "security") {
    return "Security policy boundary";
  }

  if (["db", "database"].includes(type) || /query|store|database|db/.test(label)) {
    return "Persistent data boundary";
  }

  if (["service", "handler"].includes(type) || /token|session|auth/.test(label)) {
    return "Backend execution boundary";
  }

  if (["ui", "event"].includes(type)) {
    return "User-triggered control-flow boundary";
  }

  if (["dependency", "import"].includes(type)) {
    return "Static dependency edge";
  }

  return `${node.layer} ${node.type} node`;
}

function splitLabel(label: string, maxChars: number) {
  if (label.length <= maxChars) {
    return [label];
  }

  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}
