import { Router, Request, Response } from "express";
import { publicClient, walletClient, ca, abi } from "../config/blockchain";

const router = Router();

router.get("/:id", async (req: Request, res: Response) => {
  const officeId = req.params.id;
  try {
    const office = (await publicClient.readContract({
      address: ca,
      abi,
      functionName: "offices",
      args: [BigInt(officeId)],
    })) as any[];
    return res.status(200).json({ 
      office: office[1], 
      details: {
        id: Number(office[0]),
        name: office[1],
        isValid: office[2],
        candidatesCount: Number(office[3])
      } 
    });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ status: "Error fetching offices" }); 
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Office name is required" });

  try {
    const hash = await walletClient.writeContract({
      address: ca,
      abi,
      functionName: "registerOffice",
      args: [name],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return res.status(200).json({ registered: receipt, hash });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ error });
  }
});

export default router;
