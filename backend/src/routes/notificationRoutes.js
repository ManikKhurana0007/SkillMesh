import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: [{ scheduledFor: "asc" }, { read: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return res.json({ notifications });
  } catch (error) {
    console.error("Notification loading failed:", error.message);
    return res.status(500).json({
      error: { code: "NOTIFICATIONS_UNAVAILABLE", message: "Could not load notifications." },
    });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const updated = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { read: true },
    });
    if (!updated.count) {
      return res.status(404).json({
        error: { code: "NOTIFICATION_NOT_FOUND", message: "Notification not found." },
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("Notification update failed:", error.message);
    return res.status(500).json({
      error: { code: "NOTIFICATION_UPDATE_FAILED", message: "Could not mark this notification as read." },
    });
  }
});

export default router;
