import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

@router.websocket("/ws")
async def ws(websocket: WebSocket):

    await websocket.accept()
    demo_path = [
        "ui-login-button",
        "event-onclick",
        "api-auth-login",
        "auth-handler",
        "auth-middleware",
        "user-db-query",
        "token-service",
        "session-store",
    ]

    try:
        index = 0
        while True:
            await websocket.send_json({
                "event": "execution_step",
                "status": "highlight_node",
                "node_id": demo_path[index % len(demo_path)],
                "index": index % len(demo_path),
            })
            index += 1
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
