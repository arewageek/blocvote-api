import { Router, Request, Response } from "express";
import { publicClient, walletClient, ca, abi } from "../config/blockchain";
import { sendVoteToTG } from "../services/telegram";

const router = Router();

const candidateIndex = (alpha: string): number => {
  const range = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
  const index = range.indexOf(alpha);
  if (index === -1) throw new Error("Invalid candidate identifier");
  return index;
};

// GET /votes/:index
router.get("/votes/:index", async (req: Request, res: Response) => {
  const index = req.params.index;
  try {
    const vote = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "votes",
      args: [BigInt(index)],
    })) as any[];

    return res.status(200).json({
      candidateId: Number(vote[0]),
      officeId:    Number(vote[1]),
      voterId:     Number(vote[2]),
    });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ status: "Could not get vote data" });
  }
});

// POST /vote/batch
router.post("/vote/batch", async (req: Request, res: Response) => {
  try {
    const { votes, voter_ids } = req.body; 

    if (Array.isArray(votes) && Array.isArray(voter_ids) && votes.length === voter_ids.length) {
      const votePayload = [];
      for (let i = 0; i < votes.length; i++) {
        let candidateIdStr = votes[i];
        let candidateId = typeof candidateIdStr === "number" ? candidateIdStr : candidateIndex(candidateIdStr);

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

      const hash = await walletClient.writeContract({
        address: ca,
        abi,
        functionName: "castVote",
        args: [votePayload],
      });

      sendVoteToTG(hash);
      return res.status(200).json({ voter_ids, votes, votehash: hash });
    }
    
    return res.status(400).json({ error: "Invalid payload format" });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ error: "An error occurred processing batch votes." });
  }
});

// POST /vote
router.post("/vote", async (req: Request, res: Response) => {
  const { voter, candidate } = req.body;
  if (voter === undefined || candidate === undefined) return res.status(400).json({ error: "voter and candidate are required" });

  try {
    const candidateId = typeof candidate === "number" ? candidate : candidateIndex(candidate);
    
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

    sendVoteToTG(hash);

    return res.status(200).json({ votehash: hash });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ status: "An error occurred casting the vote" });
  }
});

export default router;
