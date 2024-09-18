import express from "express";
import bAbi from "./abi/BlocVote.json";
import { ethers } from "ethers";
import { AlchemyProvider } from "ethers";
import { InfuraProvider } from "ethers";

const app = express();
const port = 4000;

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

// cast vote
app.get("/vote/:voter/:candidate", async (req, res) => {
  const voter = req.params.voter;
  const candidate = req.params.candidate;

  const candidateId = candidateIndex(candidate);
  start();
  try {
    const vote = await contract.castVote(candidateId, parseInt(voter));
    console.log({ vote });
    return res.json({ vote });
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

app.get("/keep-alive", async (req, res) => {
  const response = { status: "live" };
  console.log(response);
  res.json(response);
});

// function for converting index from alpha to numeric
const candidateIndex = (alpha: string): number => {
  const range = ["a", "b", "c", "d", "e", "f", "g", "h"];
  return range.indexOf(alpha);
};

// function for converting numerica back to alpha
const candidateAlpha = (index: number): string => {
  const range = ["a", "b", "c", "d", "e", "f", "g", "h"];
  return range[index];
};

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const start = () => console.log("Processing...");
