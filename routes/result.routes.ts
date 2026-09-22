import { Router, Request, Response } from "express";
import { publicClient, ca, abi } from "../config/blockchain";

const router = Router();

interface Result {
  candidateId: number;
  candidateName: string;
  officeId: number;
  votes: number;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const result = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "getResult",
    })) as any[];

    const data: Result[] = result.map((entry: any) => ({
      candidateId: Number(entry.candidateId),
      candidateName: entry.candidateName as string,
      officeId: Number(entry.officeId),
      votes: Number(entry.votes),
    }));

    return res.status(200).json({ result: data });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ error });
  }
});

export default router;
