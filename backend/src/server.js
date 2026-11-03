import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { attachMeetingSignaling } from "./services/meetingSignaling.js";

const PORT = process.env.PORT || 5000;
const server = createServer(app);
attachMeetingSignaling(server);

async function startServer() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected successfully.");

    server.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

startServer();