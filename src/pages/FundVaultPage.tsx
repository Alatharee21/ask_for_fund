import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, Transaction } from "@mysten/dapp-kit";
import { buildCreateVaultTx, VaultConfig } from "../sdk/ask_for_fund-sdk";

const MY_VAULTS = [
  { name: "Community Fund A", locked: 1200, dispersed: 340, active: true },
];

export default function FundVaultPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [name,       setName]       = useState("");
  const [lockAmount, setLockAmount] = useState(500);
  const [minBal,     setMinBal]     = useState(100);
  const [minStreak,  setMinStreak]  = useState(7);
  const [maxGrant,   setMaxGrant]   = useState(100);
  const [loading,    setLoading]    = useState(false);
  const [deployed,   setDeployed]   = useState(false);
  const [txDigest,   setTxDigest]   = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const handleCreate = () => {
    if (!account || !name) return;
    setLoading(true);
    setError(null);

    const config: VaultConfig = {
      name,
      lockAmountSui: lockAmount,
      minBalanceSui: minBal,
      minStreak,
      maxGrantSui:   maxGrant,
    };

    const tx = buildCreateVaultTx(config);
    signAndExecute(
      { transaction: tx, requestOptions: { showEffects: true } },
      {
        onSuccess: (result) => { setTxDigest(result.digest); setDeployed(true); setLoading(false); },
        onError:   (err)    => { setError(err.message); setLoading(false); },
      }
    );
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-eyebrow">Funder</div>
        <div className="page-title">Fund a Vault</div>
        <div className="page-subtitle">
          Lock SUI into a smart contract vault. Set eligibility rules. Approve qualified applicants.
        </div>
      </div>

      <div className="page-body">
        {!account ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◆</div>
            <div style={{ color: "var(--text2)" }}>Connect your wallet to create a vault</div>
          </div>
        ) : (
          <>
            {MY_VAULTS.length > 0 && (
              <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div className="card-title">Your Active Vaults</div>
                {MY_VAULTS.map((v, i) => {
                  const pct = Math.round(((v.locked - v.dispersed) / v.locked) * 100);
                  return (
                    <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      <div className="row-between" style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>{v.name}</div>
                        <span className={`badge ${v.active ? "badge-green" : "badge-muted"}`}>
                          {v.active ? "Active" : "Closed"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 20, fontSize: 12, fontFamily: "var(--mono)", color: "var(--text3)", marginBottom: 8 }}>
                        <span>Locked: {v.locked} SUI</span>
                        <span>Dispersed: {v.dispersed} SUI</span>
                        <span>Remaining: {v.locked - v.dispersed} SUI</span>
                      </div>
                      <div className="progress-wrap">
                        <div className="progress-fill green" style={{ width: `${pct}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 4 }}>
                        {pct}% remaining
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="card">
              <div className="card-title">Create New Vault</div>

              {deployed ? (
                <div style={{ background: "#4ade8010", border: "1px solid #4ade8040", borderRadius: "var(--radius)", padding: "1rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>✓ Vault deployed on-chain</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text2)" }}>
                    Tx: {txDigest ? `${txDigest.slice(0, 20)}…` : "pending"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                    Your FunderCap object has been transferred to your wallet. Keep it safe — it's required to approve grants.
                  </div>
                  <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => { setDeployed(false); setName(""); }}>
                    Create another vault
                  </button>
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label className="input-label">Vault Name</label>
                    <input className="input" placeholder="e.g. Ecosystem Growth Fund Q3" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Amount to Lock — {lockAmount} SUI</label>
                    <div className="range-wrap">
                      <input type="range" min={50} max={10000} step={50} value={lockAmount} onChange={(e) => setLockAmount(Number(e.target.value))} />
                      <span className="range-val">{lockAmount} SUI</span>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Min Applicant Wallet Balance — {minBal} SUI</label>
                    <div className="range-wrap">
                      <input type="range" min={100} max={1000} step={50} value={minBal} onChange={(e) => setMinBal(Number(e.target.value))} />
                      <span className="range-val">{minBal} SUI</span>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Prediction Streak Required — {minStreak} days</label>
                    <div className="range-wrap">
                      <input type="range" min={1} max={30} step={1} value={minStreak} onChange={(e) => setMinStreak(Number(e.target.value))} />
                      <span className="range-val">{minStreak} days</span>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Max Grant Per Applicant — {maxGrant} SUI</label>
                    <div className="range-wrap">
                      <input type="range" min={10} max={1000} step={10} value={maxGrant} onChange={(e) => setMaxGrant(Number(e.target.value))} />
                      <span className="range-val">{maxGrant} SUI</span>
                    </div>
                  </div>

                  <hr className="divider" />

                  <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                      Vault Config Preview
                    </div>
                    {[
                      ["Name",        name || "—"],
                      ["Lock amount", `${lockAmount} SUI`],
                      ["Min balance", `${minBal} SUI`],
                      ["Min streak",  `${minStreak} days`],
                      ["Max grant",   `${maxGrant} SUI`],
                    ].map(([k, v]) => (
                      <div key={k} className="row-between" style={{ fontSize: 13, fontFamily: "var(--mono)", padding: "3px 0" }}>
                        <span style={{ color: "var(--text3)" }}>{k}</span>
                        <span style={{ color: "var(--text)" }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16, fontFamily: "var(--mono)" }}>
                    ◆ Funds locked in Move smart contract. Only qualified applicants can receive grants. You retain admin rights via FunderCap.
                  </div>

                  {error && (
                    <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12, fontFamily: "var(--mono)" }}>✗ {error}</div>
                  )}

                  <button className="btn btn-primary btn-full btn-lg" onClick={handleCreate} disabled={loading || !name}>
                    {loading ? "Deploying vault…" : "Lock funds in vault ↗"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}