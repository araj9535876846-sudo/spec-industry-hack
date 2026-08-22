import asyncio
import json
import uuid
from typing import Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


# =========================================================
# HEALTHBRIDGE REAL-TIME ANONYMOUS CHAT SERVER
# =========================================================

app = FastAPI(
    title="HealthBridge Anonymous Chat",
    version="2.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# CONNECTION STATE
# =========================================================

class ConnectionManager:

    def __init__(self):
        # websocket -> anonymous user information
        self.active_connections: Dict[
            WebSocket, dict
        ] = {}

        # Users waiting for another anonymous person
        self.waiting_users: List[
            WebSocket
        ] = []

        # user websocket -> partner websocket
        self.partners: Dict[
            WebSocket, WebSocket
        ] = {}

        self.lock = asyncio.Lock()

    # -----------------------------------------------------
    # CREATE ANONYMOUS USER
    # -----------------------------------------------------

    def create_anonymous_id(self):

        return (
            "Anonymous-"
            + str(uuid.uuid4())[:6].upper()
        )

    # -----------------------------------------------------
    # CONNECT
    # -----------------------------------------------------

    async def connect(
        self,
        websocket: WebSocket,
    ):

        await websocket.accept()

        anonymous_id = (
            self.create_anonymous_id()
        )

        self.active_connections[
            websocket
        ] = {
            "id": anonymous_id
        }

        return anonymous_id

    # -----------------------------------------------------
    # DISCONNECT
    # -----------------------------------------------------

    async def disconnect(
        self,
        websocket: WebSocket,
    ):

        async with self.lock:

            if websocket in self.waiting_users:

                self.waiting_users.remove(
                    websocket
                )

            partner = self.partners.pop(
                websocket,
                None
            )

            self.active_connections.pop(
                websocket,
                None
            )

            if partner:

                self.partners.pop(
                    partner,
                    None
                )

                return partner

        return None

    # -----------------------------------------------------
    # FIND ANOTHER ANONYMOUS USER
    # -----------------------------------------------------

    async def find_match(
        self,
        websocket: WebSocket,
    ):

        async with self.lock:

            # Already matched
            if websocket in self.partners:
                return None

            # Find waiting user
            while self.waiting_users:

                partner = self.waiting_users.pop(
                    0
                )

                # Make sure connection is still alive
                if partner not in self.active_connections:
                    continue

                if partner == websocket:
                    continue

                self.partners[
                    websocket
                ] = partner

                self.partners[
                    partner
                ] = websocket

                return partner

            # Nobody available
            if websocket not in self.waiting_users:

                self.waiting_users.append(
                    websocket
                )

            return None

    # -----------------------------------------------------
    # SEND TO USER
    # -----------------------------------------------------

    async def send(
        self,
        websocket: WebSocket,
        data: dict,
    ):

        try:

            await websocket.send_json(
                data
            )

        except Exception:

            pass

    # -----------------------------------------------------
    # SEND TO PARTNER
    # -----------------------------------------------------

    async def send_to_partner(
        self,
        websocket: WebSocket,
        data: dict,
    ):

        partner = self.partners.get(
            websocket
        )

        if partner:

            await self.send(
                partner,
                data
            )


manager = ConnectionManager()


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
async def root():

    return {
        "status": "online",
        "service": "HealthBridge",
        "feature": "Anonymous real-time chat",
    }


# =========================================================
# STATS
# =========================================================

@app.get("/api/stats")
async def stats():

    return {
        "online_users": len(
            manager.active_connections
        ),
        "waiting_users": len(
            manager.waiting_users
        ),
        "active_chats": len(
            manager.partners
        ) // 2,
    }


# =========================================================
# WEBSOCKET CHAT
# =========================================================

@app.websocket("/ws/chat")
async def websocket_chat(
    websocket: WebSocket,
):

    anonymous_id = None

    try:

        # -------------------------------------------------
        # CONNECT USER
        # -------------------------------------------------

        anonymous_id = await manager.connect(
            websocket
        )

        # -------------------------------------------------
        # SEND ANONYMOUS ID
        # -------------------------------------------------

        await manager.send(
            websocket,
            {
                "type": "connected",
                "anonymous_id": anonymous_id,
                "message":
                    "You are connected anonymously.",
            },
        )

        # -------------------------------------------------
        # WAIT FOR MATCH
        # -------------------------------------------------

        partner = await manager.find_match(
            websocket
        )

        if partner:

            my_id = anonymous_id

            partner_id = manager.active_connections[
                partner
            ]["id"]

            # Notify current user

            await manager.send(
                websocket,
                {
                    "type": "matched",
                    "anonymous_id": my_id,
                    "partner_id": partner_id,
                    "message":
                        "You have been anonymously matched with another person.",
                },
            )

            # Notify partner

            await manager.send(
                partner,
                {
                    "type": "matched",
                    "anonymous_id":
                        manager.active_connections[
                            partner
                        ]["id"],
                    "partner_id": my_id,
                    "message":
                        "You have been anonymously matched with another person.",
                },
            )

        else:

            await manager.send(
                websocket,
                {
                    "type": "waiting",
                    "message":
                        "Waiting for another anonymous person...",
                },
            )

        # -------------------------------------------------
        # MAIN MESSAGE LOOP
        # -------------------------------------------------

        while True:

            data = await websocket.receive_json()

            message_type = data.get(
                "type"
            )

            # =================================================
            # CHAT MESSAGE
            # =================================================

            if message_type == "message":

                text = str(
                    data.get(
                        "text",
                        ""
                    )
                ).strip()

                if not text:
                    continue

                # Basic safety limit
                if len(text) > 2000:

                    await manager.send(
                        websocket,
                        {
                            "type": "error",
                            "message":
                                "Message is too long.",
                        },
                    )

                    continue

                sender = manager.active_connections[
                    websocket
                ]["id"]

                await manager.send_to_partner(
                    websocket,
                    {
                        "type": "message",
                        "sender": sender,
                        "text": text,
                    },
                )

            # =================================================
            # TYPING INDICATOR
            # =================================================

            elif message_type == "typing":

                await manager.send_to_partner(
                    websocket,
                    {
                        "type": "typing",
                        "sender":
                            manager.active_connections[
                                websocket
                            ]["id"],
                    },
                )

            # =================================================
            # STOP TYPING
            # =================================================

            elif message_type == "stop_typing":

                await manager.send_to_partner(
                    websocket,
                    {
                        "type": "stop_typing",
                    },
                )

            # =================================================
            # LEAVE CHAT
            # =================================================

            elif message_type == "leave":

                partner = manager.partners.get(
                    websocket
                )

                if partner:

                    await manager.send(
                        partner,
                        {
                            "type": "partner_left",
                            "message":
                                "The other anonymous user left the conversation.",
                        },
                    )

                break

    except WebSocketDisconnect:

        pass

    except Exception as error:

        print(
            "WebSocket error:",
            error
        )

    finally:

        partner = await manager.disconnect(
            websocket
        )

        if partner:

            await manager.send(
                partner,
                {
                    "type": "partner_left",
                    "message":
                        "The other anonymous user disconnected.",
                },
            )