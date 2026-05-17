type ExecutionSocketEvent = {
  event: string;
  status: string;
  node_id?: string;
  index?: number;
};

export function connectExecutionSocket(onEvent: (event: ExecutionSocketEvent) => void) {
  const configuredBase = process.env.NEXT_PUBLIC_WS_BASE_URL;
  let base = configuredBase ?? "ws://localhost:8000";

  if (configuredBase === "" && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    base = `${protocol}//${window.location.host}`;
  }

  const socket = new WebSocket(`${base}/ws`);

  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data));
    } catch {
      onEvent({ event: "parse_error", status: "ignored" });
    }
  };

  return () => socket.close();
}
