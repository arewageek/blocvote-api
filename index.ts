import express from "express";
import bAbi from "./abi/BlocVote.json";
import { ethers } from "ethers";
import { AlchemyProvider } from "ethers";
import { InfuraProvider } from "ethers";
import bodyParser from "body-parser";
import { Bot, InlineKeyboard } from "grammy";
import { run } from "@grammyjs/runner";

const app = express();
const port = process.env.PORT! || 4000;

let blocVote: any;
const rpc = process.env.ALCHEMY_RPC_URL!;
const deployer = process.env.DEPLOYER!;
const ca = process.env.BLOCVOTE_CA!;
const privateKey = process.env.PRIVATE_KEY!;
const abi = bAbi.abi;
const api = process.env.INFURA_API_KEY!;

const provider = new InfuraProvider(
  "sepolia",
  api,
  process.env.INFURA_PROJECT_SECRET
);
const signer = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(ca, abi, signer);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// read election chairman
app.get("/chairman", async (req, res) => {
  start();
  try {
    const chairman = await contract.chairman();
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
    const office = await contract.offices(parseInt(officeId));

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

    const registered = await contract.registerOffice(office);
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
    const candidate = await contract.candidates(parseInt(id));

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
    const registered = await contract.registerCandidate(name, parseInt(office));
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
    console.log({ votes, voter_ids });

    res.json({ status: "processed" });
  } catch (error) {
    console.log({ error });
    res.json({ error });
  }
});

// cast vote
app.post("/vote/:voter/:candidate", async (req, res) => {
  const voter = req.params.voter;
  const candidate = req.params.candidate;

  const candidateId = candidateIndex(candidate);
  start();
  try {
    const vote = await contract.castVote(candidateId, parseInt(voter));
    console.log({ vote, votehash: vote.hash });

    sendVoteToTG(vote.hash);

    return res.json({ votehash: vote.hash });
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
    const vote = await contract.votes(parseInt(index));
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
    const result = await contract.getResult();

    result.forEach((index) => {
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

const bot = new Bot(process.env.TELEGRAM_BOT_API_KEY!);

try {
  bot.command("start", async (ctx) => {
    const sender = ctx.from;
    console.log({ sender, senderId: sender?.id });
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
  } catch (error) {
    console.log({ error });
    run(bot).stop();
  }
});

try {
  run(bot);
} catch (error) {
  bot.stop();
}

const sendVoteToTG = async (hash: string) => {
  const receivers = [process.env.TG_SENDER_ID!, process.env.TG_AREWA_ID!];

  receivers.map((receiver) => {
    bot.api.sendMessage(receiver, `Transaction Hash: ${hash}`, {
      reply_markup: new InlineKeyboard()
        .webApp(
          "View on Etherscan 🚀🚀",
          `https://sepolia.etherscan.io/tx/${hash}`
        )
        .webApp(
          "View Contract 📝📝",
          `https://sepolia.etherscan.io/address/${process.env.BLOCVOTE_CA!}`
        ),
    });
  });
};

app.listen(4000, () => {
  console.log(`Server listening on port 4000`);
});
