import { Bot } from "grammy";
// import { run } from "grammy/js/runner"

const bot = new Bot(process.env.TELEGRAM_BOT_API_KEY!);

try {
  bot.command("/start", async (ctx) => {
    const sender = ctx.from;
    console.log({ sender, senderId: sender?.id });
  });
} catch (error) {
  console.log({ error });
}
