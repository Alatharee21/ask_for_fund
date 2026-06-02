import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { buildRequestGrantTx, GrantMemo } from "../sdk/ask_for_fund-sdk";
//import { Transaction } from "@mysten/sui/transactions";

const MOCK_VAULTS = [
  { id: "0xVAULT1", name: "Community Fund A", minStreak: 7,  minBalSui: 500, maxGrantSui: 200, locked: 1200, streakReq: 7  },
  { id: "0xVAULT2", name: "Builder DAO",       minStreak: 5,  minBalSui: 100, maxGrantSui: 100, locked: 340,  streakReq: 5  },
  { id: "0xVAULT3", name: "Ecosystem Growth",  minStreak: 10, minBalSui: 250, maxGrantSui: 500, locked: 3400, streakReq: 10 },
];

const MOCK_STREAK  = 7;
const MOCK_BALANCE = 412;
const PROFILE_ID   = "0xYOUR_PROFILE_OBJECT_ID";
const PROOF_COIN   = "0xYOUR_COIN_OBJECT_ID";

export default function RequestPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [title,         setTitle]         = useState("");
  const [description,   setDescription]   = useState("");
  const [links,         setLinks]         = useState("");
  const [amount,        setAmount]        = useState(50);
  const [loading,       setLoading]       = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [txDigest,      setTxDigest]      = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);

  const vault     = MOCK_VAULTS.find((v) => v.id === selectedVault);
  const qualScore = MOCK_STREAK * 10 + Math.min(9, Math.floor(MOCK_BALANCE / (vault?.minBalSui ?? 100)) - 1);

  const handleSubmit = async () => {
    if (!account || !vault || !title || !description) return;
    setLoading(true);
    setError(null);

    const memo: GrantMemo = {
      applicant:    account.address,
      title,
      description,
      requestedSui: amount,
      links:        links ? links.split("\n").filter(Boolean) : [],
      timestamp:    Date.now(),
    };

    try {
      const { tx } = await buildRequestGrantTx({
        vaultObjectId:     vault.id,
        profileObjectId:   PROFILE_ID,
        proofCoinObjectId: PROOF_COIN,
        amountSui:         amount,
        memo,
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => { setTxDigest(result.digest); setSubmitted(true); setLoading(false); },
          onError:   (err)    => { setError(err.message); setLoading(false); },
        }
      );
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-eyebrow">Step 03</div>
        <div className="page-title">Request a Grant</div>
        <div className="page-subtitle">
          Your memo is stored on Walrus. Only the blob ID is written on-chain.
        </div>
      </div>

      <div className="page-body">
        {!account ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
            <div style={{ color: "var(--text2)" }}>Connect your wallet to request a grant</div>
          </div>
        ) : submitted ? (
          <div className="card" style={{ border: "1px solid #4ade8040", background: "#4ade8008" }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--green)", marginBottom: 8 }}>✓ Grant request submitted</div>
            <div className="muted" style={{ marginBottom: 12 }}>
              Your memo was uploaded to Walrus and the blob ID recorded on-chain. The funder will review and release funds if approved.
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text3)" }}>
              Tx: {txDigest ? `${txDigest.slice(0, 20)}…` : "pending"}
            </div>
            <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => { setSubmitted(false); setTitle(""); setDescription(""); }}>
              Submit another request
            </button>
          </div>
        ) : (
          <>
            <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-box">
                <div className="stat-label">Your Streak</div>
                <div className="stat-value green">{MOCK_STREAK}<span style={{ fontSize: 13, fontWeight: 400 }}> days</span></div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Wallet Balance</div>
                <div className="stat-value green">{MOCK_BALANCE}<span style={{ fontSize: 13, fontWeight: 400 }}> SUI</span></div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Qual. Score</div>
                <div className="stat-value amber">{vault ? qualScore : "—"}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Select Vault</div>
              {MOCK_VAULTS.map((v) => {
                const eligible = MOCK_STREAK >= v.streakReq && MOCK_BALANCE >= v.minBalSui;
                return (
                  <div
                    key={v.id}
                    className={`vault-card ${selectedVault === v.id ? "selected" : ""}`}
                    onClick={() => eligible && setSelectedVault(v.id)}
                    style={{ opacity: eligible ? 1 : 0.4, cursor: eligible ? "pointer" : "not-allowed" }}
                  >
                    <div className="row-between" style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</div>
                      <div className="row" style={{ gap: 6 }}>
                        <span className={`badge ${eligible ? "badge-green" : "badge-muted"}`}>
                          {eligible ? "Eligible" : "Not eligible"}
                        </span>
                        {selectedVault === v.id && <span className="badge badge-amber">Selected</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, fontSize: 12, fontFamily: "var(--mono)", color: "var(--text3)" }}>
                      <span>Streak req: {v.streakReq}d</span>
                      <span>Min balance: {v.minBalSui} SUI</span>
                      <span>Max grant: {v.maxGrantSui} SUI</span>
                      <span>Locked: {v.locked} SUI</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <div className="card-title">Grant Details · Stored on Walrus</div>

              <div className="input-group">
                <label className="input-label">Project Title</label>
                <input className="input" placeholder="e.g. Open-source Sui DEX aggregator" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea className="input" placeholder="Describe what you're building and how the grant will be used..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 100 }} />
              </div>

              <div className="input-group">
                <label className="input-label">Links (one per line, optional)</label>
                <textarea className="input" placeholder={"https://github.com/yourproject\nhttps://yourwebsite.com"} value={links} onChange={(e) => setLinks(e.target.value)} style={{ minHeight: 60 }} />
              </div>

              <div className="input-group">
                <label className="input-label">
                  Amount Requested — {amount} SUI
                  {vault && <span style={{ color: "var(--text3)", marginLeft: 8 }}>(max {vault.maxGrantSui} SUI)</span>}
                </label>
                <div className="range-wrap">
                  <input type="range" min={1} max={vault?.maxGrantSui ?? 200} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                  <span className="range-val">{amount} SUI</span>
                </div>
              </div>

              <hr className="divider" />

              <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 16, fontFamily: "var(--mono)", fontSize: 12, color: "var(--text2)" }}>
                ◈ Memo uploaded to Walrus (52 epochs ≈ 1 year) before the on-chain tx is signed. The 32-byte blob ID is stored in the smart contract.
              </div>

              {error && (
                <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12, fontFamily: "var(--mono)" }}>✗ {error}</div>
              )}

              <button className="btn btn-primary btn-full btn-lg" onClick={handleSubmit} disabled={loading || !selectedVault || !title || !description}>
                {loading ? "Uploading to Walrus…" : "Submit request on-chain ↗"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}