"use client";

import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

/** Returns a singleton Socket.IO client, creating the connection on first call. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export interface PublicParticipant {
  id: string;
  nickname: string;
  score: number;
}

export interface PublicRoomState {
  roomCode: string;
  status: "waiting" | "in-progress" | "ended";
  participants: PublicParticipant[];
}
