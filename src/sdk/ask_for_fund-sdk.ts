/**
 * ask_for_fund — Frontend SDK
 * Walrus blob storage + Tatum RPC
 *
 * Install:
 *   npm install @mysten/dapp-kit @mysten/sui.js @tanstack/react-query @mysten/walrus
 */

/// <reference types="vite/client" />

import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from "@mysten/sui/jsonRpc";

// ── Config ────────────────────────────────────────────────────────────────────

export const PACKAGE_ID   = "0xe75a26673c6560eb1eb44c4517f24d721ed899bf67e28c456c7c439d0f393d4d";
export const ORACLE_STATE = "0x77d1be2d1abac9cc2f0dd031798fc51d54a5a4c6105c8ead63f9225fd806d2c7";
export const ONE_SUI      = 1_000_000_000n;

// ── Tatum RPC client ──────────────────────────────────────────────────────────
// Get your key at https://dashboard.tatum.io
// Tatum gives you higher rate limits and reliability vs the public RPC

const TATUM_API_KEY = import.meta.env.VITE_TATUM_API_KEY as string;
//const TATUM_RPC_URL = "/sui-rpc";

export const suiClient = new SuiJsonRpcClient({
  network: "testnet",
  transport: new JsonRpcHTTPTransport({
    url: TATUM_API_KEY
      ? "/sui-rpc"
      : "https://fullnode.testnet.sui.io",
    rpc: {
      headers: {
        "x-api-key": TATUM_API_KEY || "",
      },
    },
  }),
});


// ── Walrus config ─────────────────────────────────────────────────────────────
// Walrus publisher endpoint (community aggregator for testnet)
// For mainnet, run your own or use a trusted aggregator

// const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
// const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const WALRUS_PUBLISHER  = "/walrus-publisher";
const WALRUS_AGGREGATOR = "/walrus-aggregator";

// Storage epochs — how long the blob is retained on Walrus
// 1 epoch ≈ 1 week on testnet. Use 52 for ~1 year.
const WALRUS_EPOCHS = 52;

// ── Direction enum ────────────────────────────────────────────────────────────

export const Direction = { UP: 0, FLAT: 1, DOWN: 2 } as const;
export type Direction = typeof Direction[keyof typeof Direction];

// ── Walrus: upload grant memo ─────────────────────────────────────────────────

export interface GrantMemo {
  applicant: string;
  title: string;
  description: string;
  requestedSui: number;
  links?: string[];
  timestamp: number;
}

export interface WalrusUploadResult {
  blobId: string;           // 32-byte hex string — stored on-chain
  blobObjectId?: string;    // Sui object ID of the Walrus blob (if new)
  alreadyCertified: boolean;
}

/**
 * Upload a grant memo to Walrus.
 * Returns the blob_id to be stored on-chain in the GrantRequest.
 */
export async function uploadGrantMemo(memo: GrantMemo): Promise<WalrusUploadResult> {
  const payload = JSON.stringify(memo);

  const response = await fetch(
    `${WALRUS_PUBLISHER}/v1/store?epochs=${WALRUS_EPOCHS}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }
  );

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Walrus returns either newlyCreated or alreadyCertified
  if (result.newlyCreated) {
    return {
      blobId: result.newlyCreated.blobObject.blobId,
      blobObjectId: result.newlyCreated.blobObject.id,
      alreadyCertified: false,
    };
  } else if (result.alreadyCertified) {
    return {
      blobId: result.alreadyCertified.blobId,
      alreadyCertified: true,
    };
  }

  throw new Error("Unexpected Walrus response: " + JSON.stringify(result));
}

/**
 * Fetch and parse a grant memo from Walrus by blob_id.
 */
export async function fetchGrantMemo(blobId: string): Promise<GrantMemo> {
  const response = await fetch(`${WALRUS_AGGREGATOR}/v1/${blobId}`);

  if (!response.ok) {
    throw new Error(`Walrus fetch failed: ${response.status}`);
  }

  return response.json() as Promise<GrantMemo>;
}

/**
 * Convert a Walrus blob_id string to the 32-byte vector<u8> Move expects.
 */
export function blobIdToBytes(blobId: string): number[] {
  // Walrus blob IDs are base64url encoded 32-byte values
  const base64 = blobId.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Array.from(binary, (c) => c.charCodeAt(0));
}

// ── 1. Create prediction profile ──────────────────────────────────────────────

export function buildCreateProfileTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::prediction::create_profile`,
    arguments: [],
  });
  return tx;
}

// ── 2. Submit daily prediction ────────────────────────────────────────────────

export function buildSubmitPredictionTx(
  profileObjectId: string,
  direction: Direction,
  clockObjectId = "0x6",
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::prediction::submit_prediction`,
    arguments: [
      tx.object(profileObjectId),
      tx.object(ORACLE_STATE),
      tx.pure.u8(direction),
      tx.object(clockObjectId),
    ],
  });
  return tx;
}

// ── 3. Settle prediction ──────────────────────────────────────────────────────

export function buildSettlePredictionTx(
  profileObjectId: string,
  clockObjectId = "0x6",
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::prediction::settle_prediction`,
    arguments: [
      tx.object(profileObjectId),
      tx.object(ORACLE_STATE),
      tx.object(clockObjectId),
    ],
  });
  return tx;
}

// ── 4. Create vault (funder) ──────────────────────────────────────────────────

export interface VaultConfig {
  name: string;
  lockAmountSui: number;
  minBalanceSui: number;
  minStreak: number;
  maxGrantSui: number;
}

export function buildCreateVaultTx(config: VaultConfig): Transaction {
  const tx = new Transaction();
  const lockMist = BigInt(Math.round(config.lockAmountSui)) * ONE_SUI;
  const [fundCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(lockMist)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::grant_vault::create_vault`,
    arguments: [
      tx.pure.string(config.name),
      fundCoin,
      tx.pure.u64(BigInt(Math.round(config.minBalanceSui)) * ONE_SUI),
      tx.pure.u64(config.minStreak),
      tx.pure.u64(BigInt(Math.round(config.maxGrantSui)) * ONE_SUI),
    ],
  });
  return tx;
}

// ── 5. Request grant — uploads memo to Walrus first, then submits on-chain ────

export interface GrantRequestParams {
  vaultObjectId: string;
  profileObjectId: string;
  proofCoinObjectId: string;
  amountSui: number;
  memo: GrantMemo;           // full memo — gets uploaded to Walrus
}

/**
 * Two-step process:
 * 1. Upload memo JSON to Walrus → get blob_id
 * 2. Build Move tx with blob_id as the on-chain pointer
 */
export async function buildRequestGrantTx(
  params: GrantRequestParams
): Promise<{ tx: Transaction; blobId: string }> {

  // Step 1 — upload to Walrus
  const { blobId } = await uploadGrantMemo(params.memo);

  // Step 2 — build Move tx with blob_id bytes
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::grant_vault::request_grant`,
    arguments: [
      tx.object(params.vaultObjectId),
      tx.object(params.profileObjectId),
      tx.object(params.proofCoinObjectId),
      tx.pure.u64(BigInt(Math.round(params.amountSui)) * ONE_SUI),
      tx.pure.vector('u8',blobIdToBytes(blobId)),
    ],
  });

  return { tx, blobId };
}

// ── 6. Approve grant (funder) ─────────────────────────────────────────────────

export function buildApproveGrantTx(
  funderCapObjectId: string,
  vaultObjectId: string,
  applicantAddress: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::grant_vault::approve_grant`,
    arguments: [
      tx.object(funderCapObjectId),
      tx.object(vaultObjectId),
      tx.pure.address(applicantAddress),
    ],
  });
  return tx;
}

// ── 7. Decline grant (funder) ─────────────────────────────────────────────────

export function buildDeclineGrantTx(
  funderCapObjectId: string,
  vaultObjectId: string,
  applicantAddress: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::grant_vault::decline_grant`,
    arguments: [
      tx.object(funderCapObjectId),
      tx.object(vaultObjectId),
      tx.pure.address(applicantAddress),
    ],
  });
  return tx;
}

// ── 8. Withdraw request (applicant) ──────────────────────────────────────────

export function buildWithdrawRequestTx(vaultObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::grant_vault::withdraw_request`,
    arguments: [tx.object(vaultObjectId)],
  });
  return tx;
}

// ── 9. Query: fetch profile ───────────────────────────────────────────────────

export async function fetchProfile(profileObjectId: string) {
  const obj    = await suiClient.getObject({ id: profileObjectId, options: { showContent: true } });
  const fields = (obj.data?.content as any)?.fields;
  return {
    streak:         Number(fields.streak),
    bestStreak:     Number(fields.best_streak),
    totalCorrect:   Number(fields.total_correct),
    totalSubmitted: Number(fields.total_submitted),
    isSettled:      fields.pending_settled as boolean,
  };
}

// ── 10. Query: fetch vault ────────────────────────────────────────────────────

export async function fetchVault(vaultObjectId: string) {
  const obj    = await suiClient.getObject({ id: vaultObjectId, options: { showContent: true } });
  const fields = (obj.data?.content as any)?.fields;
  return {
    name:               new TextDecoder().decode(Uint8Array.from(fields.name)),
    balanceMist:        BigInt(fields.balance.fields.value),
    minBalanceMist:     BigInt(fields.min_balance_mist),
    minStreak:          Number(fields.min_streak),
    maxGrantMist:       BigInt(fields.max_grant_mist),
    totalDispersedMist: BigInt(fields.total_dispersed),
    active:             fields.active as boolean,
  };
}

// ── 11. Query: fetch vault requests with their Walrus memos ──────────────────

export interface EnrichedRequest {
  applicant: string;
  amountMist: bigint;
  score: number;
  streakSnapshot: number;
  blobId: string;
  memo: GrantMemo | null;    // null if Walrus fetch fails
}

export async function fetchVaultRequestsWithMemos(
  vaultObjectId: string
): Promise<EnrichedRequest[]> {
  // Get dynamic fields (the Table entries)
  const fields = await suiClient.getDynamicFields({ parentId: vaultObjectId });

  const requests = await Promise.all(
    fields.data.map(async (field) => {
      const obj    = await suiClient.getDynamicFieldObject({
        parentId: vaultObjectId,
        name: field.name,
      });
      const f = (obj.data?.content as any)?.fields?.value?.fields;

      const blobIdBytes: number[] = f.walrus_blob_id;
      const blobId = btoa(String.fromCharCode(...blobIdBytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      let memo: GrantMemo | null = null;
      try {
        memo = await fetchGrantMemo(blobId);
      } catch {
        // blob temporarily unavailable — surface what we have on-chain
      }

      return {
        applicant:      f.applicant as string,
        amountMist:     BigInt(f.amount_mist),
        score:          Number(f.score),
        streakSnapshot: Number(f.streak_snapshot),
        blobId,
        memo,
      };
    })
  );

  // Sort by score descending — most qualified first
  return requests.sort((a, b) => b.score - a.score);
}

// ── 12. Find profile object for a wallet ─────────────────────────────────────

export async function findProfileForAddress(walletAddress: string): Promise<string | null> {
  const objects = await suiClient.getOwnedObjects({
    owner: walletAddress,
    filter: { StructType: `${PACKAGE_ID}::prediction::PredictionProfile` },
    options: { showContent: false },
  });
  return objects.data[0]?.data?.objectId ?? null;
}