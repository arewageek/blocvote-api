import { Router, Request, Response } from "express";
import { publicClient, ca, abi } from "../config/blockchain";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const chairman = await publicClient.readContract({
      address: ca,
      abi,
      functionName: "chairman",
    });
    return res.status(200).json({ chairman });
  } catch (error) {
    console.error({ error });
    return res.status(500).json({ error: "Error fetching election chairman" });
  }
});

export default router;
