import express from "express";
import bAbi from "./abi/BlocVote.json";
import { Bot, InlineKeyboard } from "grammy";
import { run } from "@grammyjs/runner";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const app = express();
const port = process.env.PORT! || 4000;

const rpc = process.env.ALCHEMY_RPC_URL!;
const ca = (process.env.BLOCVOTE_CA?.startsWith("0x") ? process.env.BLOCVOTE_CA : `0x${process.env.BLOCVOTE_CA}`) as `0x${string}`;
const privateKeyStr = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";
const privateKey = (privateKeyStr.startsWith("0x") ? privateKeyStr : `0x${privateKeyStr}`) as `0x${string}`;
const abi = bAbi.abi;
const api = process.env.INFURA_API_KEY || "dummy";

const account = privateKeyToAccount(privateKey);

const transport = http(rpc || `https://sepolia.infura.io/v3/${api}`);

const publicClient = createPublicClient({
  chain: sepolia,
  transport,
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// read election chairman
app.get("/chairman", async (req, res) => {
  start();
  try {
    const chairman = await publicClient.readContract({
      address: ca,
      abi,
      functionName: "chairman",
    });
    console.log({ chairman });
    return res.json({ chairman });
  } catch (error) {
    console.log({ error });
    return res.json({ status: "Error fetching election official" });
  }
});

// read specific office data
app.get("/office/:id", async (req, res) => {
  const officeId = req.params.id;

  start();
  try {
    const office = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "offices",
      args: [BigInt(officeId)],
    })) as any;

    console.log({ office });

    return res.json({ office: office[1] });
  } catch (error) {
    console.log({ error });
    return res.json({ status: "Error fetching offices" });
  }
});

// register new office
app.get("/office/new/:office", async (req, res) => {
  start();
  try {
    const office = req.params.office;

    const hash = await walletClient.writeContract({
      address: ca,
      abi,
      functionName: "registerOffice",
      args: [office],
    });
    const registered = await publicClient.waitForTransactionReceipt({ hash });
    console.log({ registered });
    return res.json({ registered });
  } catch (error) {
    console.log({ error });
    return res.json({ error });
  }
});

// read a specific candidate
app.get("/candidate/:id", async (req, res) => {
  const id = req.params.id;

  start();
  try {
    const candidate = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "candidates",
      args: [BigInt(id)],
    })) as any;

    console.log({ candidate });

    return res.json({
      office: {
        name: candidate[1],
        officeId: Number(candidate[2]),
        votes: Number(candidate[4]),
      },
    });
  } catch (error) {
    console.log({ error });
    return res.json({ status: "Error fetching offices" });
  }
});

// register new candidate
app.get("/candidate/new/:name/:office", async (req, res) => {
  start();
  const name = req.params.name;
  const office = req.params.office;

  try {
    const hash = await walletClient.writeContract({
      address: ca,
      abi,
      functionName: "registerCandidate",
      args: [name, BigInt(office)],
    });
    const registered = await publicClient.waitForTransactionReceipt({ hash });
    console.log({ registered });
    return res.json({ registered });
  } catch (error) {
    console.log({ error });
    return res.json({ error });
  }
});

app.get("/vote", async (req, res) => {
  start();
  try {
    const { votes, voter_ids } = req.body;
    console.log("Received votes:", { votes, voter_ids });

    if (Array.isArray(votes) && Array.isArray(voter_ids) && votes.length === voter_ids.length) {
      const votePayload = [];
      for (let i = 0; i < votes.length; i++) {
        const candidateId = candidateIndex(votes[i]);
        const candidateData = (await publicClient.readContract({
          address: ca,
          abi,
          functionName: "candidates",
          args: [BigInt(candidateId)],
        })) as any[];
        const officeId = candidateData[2];

        votePayload.push({
          candidateId: BigInt(candidateId),
          officeId: BigInt(officeId),
          voterId: BigInt(voter_ids[i]),
        });
      }

      try {
        const hash = await walletClient.writeContract({
          address: ca,
          abi,
          functionName: "castVote",
          args: [votePayload],
        });
        console.log({ votehash: hash });
        
        sendVoteToTG("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      } catch (txError) {
        console.log(`Failed to process batch vote`, txError);
      }
    }

    res.json({ voter_ids, votes });
  } catch (error) {
    console.log({ error });
    res.json({ error: "An error occurred processing batch votes." });
  }
});

// cast vote
app.post("/vote/:voter/:candidate", async (req, res) => {
  const voter = req.params.voter;
  const candidate = req.params.candidate;

  const candidateId = candidateIndex(candidate);
  start();
  try {
    const candidateData = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "candidates",
      args: [BigInt(candidateId)],
    })) as any[];
    const officeId = candidateData[2];

    const hash = await walletClient.writeContract({
      address: ca,
      abi,
      functionName: "castVote",
      args: [[{ candidateId: BigInt(candidateId), officeId: BigInt(officeId), voterId: BigInt(voter) }]],
    });
    console.log({ votehash: hash });

    sendVoteToTG("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");

    return res.json({ votehash: hash });
  } catch (error) {
    console.log({ error });
    return res.json({ status: "An error occurred casting the vote" });
  }
});

// get specific vote data
app.get("/votes/:index", async (req, res) => {
  const index = req.params.index;
  start();
  try {
    const vote = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "votes",
      args: [BigInt(index)],
    })) as any;
    console.log({ vote });
    return res.json({ candidate: Number(vote[0]), voter: Number(vote[1]) });
  } catch (error) {
    console.log({ error });
    return res.json({ status: "Could not get vote data" });
  }
});

// read election result
interface Result {
  candidate: string;
  officeIndex: number;
  votes: number;
}
app.get("/result", async (req, res) => {
  let data: Result[] = [];
  start();
  try {
    const result = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "getResult",
    })) as any[];

    result.forEach((index: any) => {
      data.push({
        candidate: candidateAlpha(Number(index[0])),
        officeIndex: Number(index[1]),
        votes: Number(index[2]),
      });
    });

    console.log({ result: data });
    return res.json({ result: data });
  } catch (error) {
    console.log({ error });
    return res.json({ error });
  }
});

// function for converting index from alpha to numeric
const candidateIndex = (alpha: string): number => {
  const range = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
  return range.indexOf(alpha);
};

// function for converting numerica back to alpha
const candidateAlpha = (index: number): string => {
  const range = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
  return range[index];
};

const start = () => console.log("Processing...");

// api integration

const bot = new Bot(process.env.TELEGRAM_BOT_API_KEY || "dummy_token");

const activeUsers = new Set<string | number>();

try {
  bot.command("start", async (ctx) => {
    const sender = ctx.from;
    console.log({ sender, senderId: sender?.id });
    if (sender?.id) {
      activeUsers.add(sender.id);
    }
    ctx.reply("Welcome to BlocVote! Submit a vote via the API to receive a demo transaction hash.");
  });
} catch (error) {
  console.log({ error });
  bot.stop();
}

app.get("/webhook/delete", async function (req, res) {
  try {
    const response = await bot.api.deleteWebhook();
    console.log({ status: response });
    return res.json({ status: 200 });
  } catch (error) {
    console.log({ error });
    return res.json({ status: 500 });
  }
});

app.get("/bot/init", async function (req, res) {
  try {
    run(bot).isRunning() || run(bot).start();
    return res.json({ status: "Bot started" });
  } catch (error) {
    console.log({ error });
    run(bot).stop();
    return res.json({ error: "Failed to start bot" });
  }
});

try {
  run(bot);
} catch (error) {
  bot.stop();
}

const sendVoteToTG = async (hash: string) => {
  const receivers = new Set([
    process.env.TG_SENDER_ID,
    process.env.TG_AREWA_ID,
    ...Array.from(activeUsers)
  ].filter(Boolean) as (string | number)[]);

  for (const receiver of receivers) {
    try {
      await bot.api.sendMessage(receiver, `Demo Transaction Hash: ${hash}`, {
        reply_markup: new InlineKeyboard()
          .url(
            "View on Etherscan 🚀🚀",
            `https://sepolia.etherscan.io/tx/${hash}`
          )
          .url(
            "View Contract 📝📝",
            `https://sepolia.etherscan.io/address/${process.env.BLOCVOTE_CA || "0x0"}`
          ),
      });
    } catch (err) {
      console.log(`Failed to send message to ${receiver}:`, err);
    }
  }
};

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export { app };
