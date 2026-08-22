# Add this block to your EXISTING FastAPI backend.
# It powers the new anonymous real-world peer chat in App.jsx.

import asyncio
from collections import defaultdict
from fastapi import WebSocket, WebSocketDisconnect

# (language, concern) -> waiting anonymous socket
_peer_waiting = defaultdict(list)
_peer_lock = asyncio.Lock()
_peer_partner = {}


async def _send_json(socket: WebSocket, payload: dict):
    try:
        await socket.send_json(payload)
    except Exception:
        pass


@app.websocket("/ws/peer")
async def anonymous_peer_chat(websocket: WebSocket):
    await websocket.accept()

    session_id = None
    match_key = None
    partner = None

    try:
        join = await websocket.receive_json()

        if join.get("type") != "join":
            await websocket.close(code=1008)
            return

        # Only temporary anonymous/session information is used.
        session_id = str(join.get("session_id", "anonymous"))
        language = str(join.get("language", "auto"))
        concern = str(join.get("concern", "General Health"))
        match_key = (language, concern)

        async with _peer_lock:
            # Remove dead sockets from this queue first.
            queue = _peer_waiting[match_key]
            queue[:] = [item for item in queue if item.client_state.name == "CONNECTED"]

            if queue:
                partner = queue.pop(0)
                _peer_partner[websocket] = partner
                _peer_partner[partner] = websocket
            else:
                queue.append(websocket)

        if partner is None:
            await _send_json(
                websocket,
                {"type": "status", "message": "Waiting for an anonymous peer with a compatible language and concern…"},
            )
        else:
            await _send_json(websocket, {"type": "matched"})
            await _send_json(partner, {"type": "matched"})

        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "message":
                target = _peer_partner.get(websocket)
                if target:
                    await _send_json(
                        target,
                        {
                            "type": "message",
                            "id": data.get("id"),
                            "text": str(data.get("text", ""))[:4000],
                        },
                    )

            elif message_type == "typing":
                target = _peer_partner.get(websocket)
                if target:
                    await _send_json(
                        target,
                        {"type": "typing", "active": bool(data.get("active"))},
                    )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print("Anonymous peer socket error:", exc)
    finally:
        async with _peer_lock:
            # Remove from waiting queue if still waiting.
            if match_key and websocket in _peer_waiting.get(match_key, []):
                _peer_waiting[match_key].remove(websocket)

            partner = _peer_partner.pop(websocket, None)

            if partner:
                _peer_partner.pop(partner, None)
                await _send_json(
                    partner,
                    {"type": "peer_left"},
                )