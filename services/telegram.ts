import { Bot, InlineKeyboard } from "grammy";
import { run } from "@grammyjs/runner";
import { ca } from "../config/blockchain";

export const bot = new Bot(process.env.TELEGRAM_BOT_API_KEY || "dummy_token");
const activeUsers = new Set<string | number>();

try {
  bot.command("start", async (ctx) => {
    const sender = ctx.from;
    console.log({ sender, senderId: sender?.id });
    if (sender?.id) {
      activeUsers.add(sender.id);
    }
    await ctx.reply("Welcome to BlocVote! Any votes cast will be notified here with their transaction hash.");
  });
} catch (error) {
  console.log({ error });
  bot.stop();
}

export const startBot = () => {
  try {
    if (!run(bot).isRunning()) {
      run(bot).start();
    }
  } catch (error) {
    console.error({ error });
    bot.stop();
  }
};

export const sendVoteToTG = async (hash: string) => {
  const receivers = new Set([
    process.env.TG_SENDER_ID,
    process.env.TG_AREWA_ID,
    ...Array.from(activeUsers)
  ].filter(Boolean) as (string | number)[]);

  for (const receiver of receivers) {
    try {
      await bot.api.sendMessage(receiver, `Vote Transaction Hash: ${hash}`, {
        reply_markup: new InlineKeyboard()
          .url(
            "View on Etherscan 🚀",
            `https://sepolia.etherscan.io/tx/${hash}`
          )
          .url(
            "View Contract 📝",
            `https://sepolia.etherscan.io/address/${ca}`
          ),
      });
    } catch (err) {
      console.log(`Failed to send message to ${receiver}:`, err);
    }
  }
};
