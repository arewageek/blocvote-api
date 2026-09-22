import { mock, test, expect, describe, beforeAll } from "bun:test";
import request from "supertest";

// We must set NODE_ENV before importing app
process.env.NODE_ENV = "test";

// Mock viem
mock.module("viem", () => {
  return {
    createPublicClient: () => ({
      readContract: async ({ functionName, args }: any) => {
        if (functionName === "chairman") return "0x123ChairmanAddress";
        if (functionName === "offices") return [1n, "Office Description", true, 10n];
        if (functionName === "candidates") return [1n, "Candidate Description", 100n, true, 20n];
        if (functionName === "votes") return [1n, 2n, 3n];
        if (functionName === "getResult") return [{ candidateId: 1n, candidateName: "Candidate", officeId: 2n, votes: 50n }];
        if (functionName === "waitForTransactionReceipt") return { status: "success" };
        return null;
      },
      getTransactionCount: async () => 1,
      waitForTransactionReceipt: async () => ({ status: "success" }),
    }),
    createWalletClient: () => ({
      writeContract: async () => "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    }),
    http: () => ({}),
  };
});

mock.module("viem/accounts", () => ({
  privateKeyToAccount: () => ({ address: "0x123" }),
}));

mock.module("viem/chains", () => ({
  sepolia: { id: 11155111 },
}));

mock.module("grammy", () => ({
  Bot: class {
    api = {
      sendMessage: async () => true,
      deleteWebhook: async () => true,
    };
    command = () => {};
    stop = () => {};
  },
  InlineKeyboard: class {
    url() { return this; }
  }
}));

mock.module("@grammyjs/runner", () => ({
  run: () => ({
    isRunning: () => true,
    start: () => {},
    stop: () => {},
  })
}));

describe("BlocVote API Flow", () => {
  let app: any;

  beforeAll(async () => {
    const mod = await import("./index.ts");
    app = mod.app;
  });

  test("GET /chairman should return chairman address", async () => {
    const res = await request(app).get("/chairman");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ chairman: "0x123ChairmanAddress" });
  });

  test("GET /office/:id should return office details", async () => {
    const res = await request(app).get("/office/1");
    expect(res.status).toBe(200);
    expect(res.body.office).toBe("Office Description");
  });

  test("GET /candidate/:id should return candidate details", async () => {
    const res = await request(app).get("/candidate/1");
    expect(res.status).toBe(200);
    expect(res.body.office).toBeDefined();
    expect(res.body.office.name).toBe("Candidate Description");
  });

  test("POST /office should return tx hash or registered", async () => {
    const res = await request(app).post("/office").send({ name: "President" });
    expect(res.status).toBe(200);
    expect(res.body.registered).toBeDefined();
    expect(res.body.registered.status).toBe("success");
  });

  test("POST /office should return 400 if name is missing", async () => {
    const res = await request(app).post("/office").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Office name is required");
  });

  test("POST /candidate should return registered status", async () => {
    const res = await request(app).post("/candidate").send({ name: "JohnDoe", officeId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.registered).toBeDefined();
    expect(res.body.registered.status).toBe("success");
  });

  test("POST /candidate should return 400 if fields are missing", async () => {
    const res = await request(app).post("/candidate").send({ name: "JohnDoe" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Candidate name and officeId are required");
  });

  test("POST /vote should cast a single vote and return hash", async () => {
    const res = await request(app).post("/vote").send({ voter: 1, candidate: "A" });
    expect(res.status).toBe(200);
    expect(res.body.votehash).toBe("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  });

  test("POST /vote should handle invalid candidate gracefully", async () => {
    const res = await request(app).post("/vote").send({ voter: 1, candidate: "Z" });
    expect(res.status).toBe(500); // Because it throws an error in Viem trying to fetch candidate details or cast
  });

  test("POST /vote should return 400 if fields are missing", async () => {
    const res = await request(app).post("/vote").send({ voter: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("voter and candidate are required");
  });

  test("POST /vote/batch should process batch votes", async () => {
    const res = await request(app).post("/vote/batch").send({
      votes: ["A", "B"],
      voter_ids: [1, 2]
    });
    expect(res.status).toBe(200);
    expect(res.body.votes).toEqual(["A", "B"]);
    expect(res.body.voter_ids).toEqual([1, 2]);
    expect(res.body.votehash).toBe("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  });

  test("POST /vote/batch should return 400 on mismatched arrays", async () => {
    const res = await request(app).post("/vote/batch").send({
      votes: ["A", "B"],
      voter_ids: [1] // mismatched length
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid payload format");
  });

  test("GET /votes/:index should return specific vote data", async () => {
    const res = await request(app).get("/votes/0");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ candidateId: 1, officeId: 2, voterId: 3 });
  });

  test("GET /result should return results", async () => {
    const res = await request(app).get("/result");
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result[0].votes).toBe(50);
  });
  
  test("POST /bot/init should return Bot started", async () => {
    const res = await request(app).post("/bot/init");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "Bot started" });
  });
});
