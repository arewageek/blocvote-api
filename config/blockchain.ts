import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import bAbi from "../abi/BlocVote.json";

const rpc = process.env.ALCHEMY_RPC_URL!;
const caStr = process.env.BLOCVOTE_CA || "0x0000000000000000000000000000000000000000";
export const ca = (caStr.startsWith("0x") ? caStr : `0x${caStr}`) as Address;

const privateKeyStr = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const privateKey = (privateKeyStr.startsWith("0x") ? privateKeyStr : `0x${privateKeyStr}`) as `0x${string}`;

export const abi = bAbi.abi;
const api = process.env.INFURA_API_KEY || "dummy";

const account = privateKeyToAccount(privateKey);
const transport = http(rpc || `https://sepolia.infura.io/v3/${api}`);

export const publicClient = createPublicClient({
  chain: sepolia,
  transport,
});

export const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport,
});
