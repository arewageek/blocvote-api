import { Router, Request, Response } from "express";
import { publicClient, walletClient, ca, abi } from "../config/blockchain";

const router = Router();

router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const candidate = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "candidates",
      args: [BigInt(id)],
    })) as any[];
    return res.status(200).json({
      office: {
        name: candidate[1],
        officeId: Number(candidate[2]),
        votes: Number(candidate[4]),
      },
    });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ status: "Error fetching offices" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { name, officeId } = req.body;
  if (!name || officeId === undefined) return res.status(400).json({ error: "Candidate name and officeId are required" });

  try {
    const hash = await walletClient.writeContract({
      address: ca,
      abi,
      functionName: "registerCandidate",
      args: [name, BigInt(officeId)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return res.status(200).json({ registered: receipt, hash });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ error });
  }
});

export default router;
