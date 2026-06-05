import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { buildApproveGrantTx, buildDeclineGrantTx } from "../sdk/ask_for_fund-sdk";
import { Transaction } from '@mysten/sui/transactions';

interface MockRequest {
  id:          string;
  applicant:   string;
  amount:      number;
  score:       number;
  streak:      number;
  balance:     number;
  blobId:      string;
  title:       string;
  description: string;
  status:      "pending" | "approved" | "declined";
}

const INITIAL_REQUESTS: MockRequest[] = [
  {
    id: "req1", applicant: "0x4f2a…c89e", amount: 120, score: 98, streak: 7, balance: 890,
    blobId: "bafyrei…xk2p",
    title: "Cross-chain bridge UI for Sui",
    description: "Building a user-friendly frontend for bridging assets between Sui and EVM chains, with real-time fee estimation and transaction tracking.",
    status: "pending",
  },
  {
    id: "req2", applicant: "0x8b1c…f34d", amount: 50, score: 74, streak: 6, balance: 412,
    blobId: "bafyrei…m3n7",
    title: "Open source Sui wallet SDK docs",
    description: "Comprehensive documentation and interactive examples for the Sui wallet SDK to help onboard more developers to the ecosystem.",
    status: "pending",
  },
  {
    id: "req3", applicant: "0x2d7f…a91b", amount: 80, score: 42, streak: 5, balance: 105,
    blobId: "bafyrei…q9z1",
    title: "NFT marketplace for Sui",
    description: "A gas-efficient NFT marketplace with batch listing, collection analytics, and Kiosk integration.",
    status: "pending",
  },
];

const FUNDER_CAP = "0xYOUR_FUNDER_CAP_ID";
const VAULT_ID   = "0xYOUR_VAULT_ID";

export default function ReviewGrantsPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [requests, setRequests] = useState<MockRequest[]>(INITIAL_REQUESTS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading,  setLoading]  = useState<string | null>(null);

  const handleApprove = (req: MockRequest) => {
    setLoading(req.id);

 const buildApproveGrantTx = (funderCap: string, vaultId: string, applicant: string) => {
  const tx = new Transaction();

  tx.moveCall({
    target: `0x8aa86ab45973d8bcfc050555dce04b65b548891b3e714f6639915564af444d29::grant_module::approve_grant`,
    arguments: [
      tx.object(funderCap),
      tx.object(vaultId),
      tx.pure.address(applicant), // New pure syntax
    ],
  });
  };

  const handleDecline = (req: MockRequest) => {
    setLoading(req.id);
const buildDeclineGrantTx = (funderCap: string, vaultId: string, applicant: string) => {
  // 2. Change 'new TransactionBlock()' to 'new Transaction()'
  const tx = new Transaction();

  tx.moveCall({
    target: `PACKAGE_ID::grant_module::decline_grant`, // Use your actual package and function name
    arguments: [
      tx.object(funderCap),
      tx.object(vaultId),
      tx.pure.address(applicant), // Updates the pure serialization syntax
    ],
  });

  // 3. This now returns a modern Transaction object that matches your frontend hook
  return tx; 
};
  };

  const pending  = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-eyebrow">Funder</div>
        <div className="page-title">Review Grants</div>
        <div className="page-subtitle">Ranked by qualification score. Memos fetched from Walrus.</div>
      </div>

      <div className="page-body">
        {!account ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◇</div>
            <div style={{ color: "var(--text2)" }}>Connect your funder wallet to review requests</div>
          </div>
        ) : (
          <>
            <div className="stat-grid-4" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-box">
                <div className="stat-label">Pending</div>
                <div className="stat-value amber">{pending.length}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Approved</div>
                <div className="stat-value green">{requests.filter((r) => r.status === "approved").length}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Declined</div>
                <div className="stat-value red">{requests.filter((r) => r.status === "declined").length}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Total Requested</div>
                <div className="stat-value">{pending.reduce((a, r) => a + r.amount, 0)}<span style={{ fontSize: 13, fontWeight: 400 }}> SUI</span></div>
              </div>
            </div>

            {pending.length > 0 && (
              <div className="card">
                <div className="card-title">Pending Requests · Sorted by Score</div>
                {pending.map((req, i) => (
                  <div key={req.id} className={`request-card ${i === 0 ? "top-ranked" : ""}`} style={{ opacity: loading === req.id ? 0.6 : 1 }}>
                    <div className="row-between" style={{ marginBottom: 8 }}>
                      <div className="row" style={{ gap: 10 }}>
                        {i === 0 && <span className="badge badge-amber">Top ranked</span>}
                        <span className="requester-addr">{req.applicant}</span>
                      </div>
                      <span className="badge" style={{
                        background: req.score >= 80 ? "#4ade8018" : req.score >= 60 ? "#f5a62318" : "#f8717118",
                        color:      req.score >= 80 ? "var(--green)" : req.score >= 60 ? "var(--amber)" : "var(--red)",
                        border:     req.score >= 80 ? "1px solid #4ade8030" : req.score >= 60 ? "1px solid #f5a62330" : "1px solid #f8717130",
                      }}>
                        Score {req.score}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{req.title}</div>

                    <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: "var(--mono)", color: "var(--text3)", marginBottom: 10 }}>
                      <span>Streak: {req.streak}d ✓</span>
                      <span>Balance: {req.balance} SUI</span>
                      <span>Requesting: {req.amount} SUI</span>
                    </div>

                    <div
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", marginBottom: 12, cursor: "pointer" }}
                      onClick={() => setExpanded(expanded === req.id ? null : req.id)}
                    >
                      <div className="row-between">
                        <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Walrus memo · {req.blobId}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text3)" }}>{expanded === req.id ? "▲" : "▼"}</span>
                      </div>
                      {expanded === req.id && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
                          {req.description}
                        </div>
                      )}
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req)} disabled={loading === req.id}>
                        {loading === req.id ? "…" : "Approve ↗"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDecline(req)} disabled={loading === req.id}>
                        Decline
                      </button>
                      <button className="btn btn-ghost btn-sm">View on Walrus ↗</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pending.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                <div style={{ color: "var(--text2)" }}>No pending requests</div>
              </div>
            )}

            {resolved.length > 0 && (
              <div className="card" style={{ marginTop: "1rem" }}>
                <div className="card-title">Resolved</div>
                {resolved.map((req) => (
                  <div key={req.id} className="request-card" style={{ opacity: 0.5 }}>
                    <div className="row-between">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{req.title}</div>
                        <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--text3)", marginTop: 2 }}>
                          {req.applicant} · {req.amount} SUI
                        </div>
                      </div>
                      <span className={`badge ${req.status === "approved" ? "badge-green" : "badge-red"}`}>
                        {req.status === "approved" ? "✓ Approved" : "✗ Declined"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}}