import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const meetingPath = "/api/mentor/meeting-signal";
const joinWindowBeforeMs = 15 * 60 * 1000;
const joinWindowAfterMs = 30 * 60 * 1000;

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function roomPeers(room, excludedSocket) {
  return [...room].filter(socket => socket !== excludedSocket && socket.readyState === WebSocket.OPEN);
}

function validSignal(signal) {
  if (!signal || typeof signal !== "object" || Array.isArray(signal)) return false;
  if (signal.description) {
    return ["offer", "answer"].includes(signal.description.type)
      && typeof signal.description.sdp === "string"
      && signal.description.sdp.length <= 60_000;
  }
  if (signal.candidate) {
    return typeof signal.candidate.candidate === "string"
      && signal.candidate.candidate.length <= 2_000;
  }
  return false;
}

async function authenticateUpgrade(request) {
  const cookie = request.headers.cookie || "";
  const token = cookie.split(";").map(part => part.trim()).find(part => part.startsWith("token="))?.slice(6);
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
    if (typeof decoded === "string" || typeof decoded.userId !== "string") return null;
    return prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, role: true },
    });
  } catch {
    return null;
  }
}

function originAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const configured = process.env.FRONTEND_URL || "http://localhost:5173";
    return new URL(origin).origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

async function joinRoom(socket, sessionId, rooms) {
  if (socket.meetingRoom) throw new Error("You have already joined a meeting.");
  if (typeof sessionId !== "string" || sessionId.length > 100) throw new Error("Invalid meeting session.");
  const session = await prisma.mentorshipSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      mentorId: true,
      startsAt: true,
      duration: true,
      capacity: true,
      status: true,
      bookings: {
        where: { status: "BOOKED" },
        select: { studentId: true },
      },
    },
  });
  if (!session || session.status !== "OPEN") throw new Error("This meeting is not open.");
  const isMentor = session.mentorId === socket.user.id && socket.user.role === "MENTOR";
  const isAttendee = socket.user.role === "STUDENT"
    && session.bookings.some(booking => booking.studentId === socket.user.id);
  if (!isMentor && !isAttendee) throw new Error("Only the mentor and booked students can join this meeting.");
  const startsAt = session.startsAt.getTime();
  const endsAt = startsAt + session.duration * 60 * 1000;
  const now = Date.now();
  if (now < startsAt - joinWindowBeforeMs || now > endsAt + joinWindowAfterMs) {
    throw new Error("The meeting room opens 15 minutes before its start and closes 30 minutes after it ends.");
  }

  const room = rooms.get(session.id) || new Set();
  if ([...room].some(peer => peer.user.id === socket.user.id)) {
    throw new Error("This account is already connected to the meeting.");
  }
  if (room.size >= session.capacity + 1) throw new Error("This meeting has reached its attendee capacity.");

  socket.meetingRoom = session.id;
  room.add(socket);
  rooms.set(session.id, room);
  send(socket, {
    type: "joined",
    peers: roomPeers(room, socket).map(peer => ({ id: peer.user.id, name: peer.user.name })),
  });
  for (const peer of roomPeers(room, socket)) {
    send(peer, { type: "peer-joined", peer: { id: socket.user.id, name: socket.user.name } });
  }
}

export function attachMeetingSignaling(server) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 96 * 1024 });
  const rooms = new Map();

  server.on("upgrade", (request, socket, head) => {
    let path;
    try {
      path = new URL(request.url, "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (path !== meetingPath) {
      socket.destroy();
      return;
    }
    if (!originAllowed(request)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    void authenticateUpgrade(request).then(user => {
      if (!user || !["MENTOR", "STUDENT"].includes(user.role)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      webSocketServer.handleUpgrade(request, socket, head, client => {
        client.user = user;
        client.isAlive = true;
        webSocketServer.emit("connection", client, request);
      });
    }).catch(error => {
      console.error("Meeting WebSocket authentication failed:", error.message);
      socket.destroy();
    });
  });

  webSocketServer.on("connection", client => {
    client.on("pong", () => { client.isAlive = true; });
    client.on("message", data => {
      void (async () => {
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch {
          throw new Error("Invalid meeting message.");
        }
        if (message.type === "join") {
          await joinRoom(client, message.sessionId, rooms);
          return;
        }
        if (message.type !== "signal" || !client.meetingRoom || !validSignal(message.signal)) {
          throw new Error("Invalid meeting signal.");
        }
        const room = rooms.get(client.meetingRoom);
        const recipient = room && [...room].find(peer => peer.user.id === message.toUserId);
        if (!recipient) throw new Error("The meeting participant is no longer connected.");
        send(recipient, {
          type: "signal",
          from: { id: client.user.id, name: client.user.name },
          signal: message.signal,
        });
      })().catch(error => send(client, { type: "error", message: error.message }));
    });

    client.on("close", () => {
      const roomId = client.meetingRoom;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.delete(client);
      for (const peer of room) send(peer, { type: "peer-left", peerId: client.user.id });
      if (!room.size) rooms.delete(roomId);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of webSocketServer.clients) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 25_000);
  heartbeat.unref();
  webSocketServer.on("close", () => clearInterval(heartbeat));
  return webSocketServer;
}
