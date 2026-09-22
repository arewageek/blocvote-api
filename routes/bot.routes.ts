import { Router, Request, Response } from "express";
import { bot, startBot } from "../services/telegram";

const router = Router();

router.post("/webhook/delete", async (req: Request, res: Response) => {
  try {
    const response = await bot.api.deleteWebhook();
    return res.status(200).json({ status: 200, response });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ status: 500, error });
  }
});

router.post("/bot/init", async (req: Request, res: Response) => {
  try {
    startBot();
    return res.status(200).json({ status: "Bot started" });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ error: "Failed to start bot" });
  }
});

export default router;
