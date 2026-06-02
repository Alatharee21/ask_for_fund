import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { buildSubmitPredictionTx, Direction } from "../sdk/ask_for_fund-sdk";

type PredDir = "up" | "flat" | "down" | null;

const MOCK_PRICE    = 3.84;
const MOCK_CHANGE   = 4.2;
const STREAK_TARGET = 7;
const CURRENT_STREAK = 5;

export default function PredictPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [selected,  setSelected]  = useState<PredDir>(null);
  const [submitted, setSubmitted] = useState(false);
  const [txDigest,  setTxDigest]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const PROFILE_ID = "0xYOUR_PROFILE_OBJECT_ID";

  const directionMap: Record<NonNullable<PredDir>, Direction> = {
    up: Direction.UP, flat: Direction.FLAT, down: Direction.DOWN,
  };

  /*const handleSubmit = () => {
    if (!selected || !account) return;
    setLoading(true);
    setError(null);

    const tx = buildSubmitPredictionTx(PROFILE_ID, directionMap[selected]);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => { setTxDigest(result.digest); setSubmitted(true); setLoading(false); },
        onError:   (err)    => { setError(err.message); setLoading(false); },
      }
    );
  };*/

  const handleSubmit = async () => {
  if (!selected || !account) return;
  setLoading(true);
  setError(null);

  try {
    const tx = buildSubmitPredictionTx(PROFILE_ID, directionMap[selected]);

    signAndExecute(
      { 
        // Force evaluation of the transaction instance into the expected structure
        transaction: tx },
      
      {
        onSuccess: (result) => { 
          setTxDigest(result.digest); 
          setSubmitted(true); 
          setLoading(false); 
        },
        onError: (err) => { 
          setError(err.message); 
          setLoading(false); 
        },
      }
    );
  } catch (e: any) {
    setError(e.message);
    setLoading(false);
  }
};


  const options = [
    { dir: "up"   as PredDir, arrow: "↑", label: "Up",          sub: "+10% or more",  cls: "up"   },
    { dir: "flat" as PredDir, arrow: "↔", label: "Consolidate", sub: "within ±10%",   cls: "flat" },
    { dir: "down" as PredDir, arrow: "↓", label: "Down",        sub: "−10% or more",  cls: "down" },
  ];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-eyebrow">Step 02</div>
        <div className="page-title">Daily Prediction</div>
        <div className="page-subtitle">
          Predict SUI's price direction for the next 24 hours. Gas fee required on-chain.
        </div>
      </div>

      <div className="page-body">
        {!account ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ color: "var(--text2)" }}>Connect your wallet to predict</div>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Streak Progress</div>
                <span className="badge badge-amber">Day {CURRENT_STREAK} of {STREAK_TARGET}</span>
              </div>
              <div className="progress-wrap">
                <div className="progress-fill" style={{ width: `${(CURRENT_STREAK / STREAK_TARGET) * 100}%` }} />
              </div>
              <div className="row-between" style={{ marginTop: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>
                  {CURRENT_STREAK} correct in a row
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>
                  {STREAK_TARGET - CURRENT_STREAK} more to qualify
                </span>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Market Snapshot</div>
              <div className="row-between">
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--mono)", letterSpacing: "-0.02em" }}>
                    ${MOCK_PRICE.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "var(--mono)" }}>SUI / USD</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--green)" }}>
                    +{MOCK_CHANGE}%
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>24h change</div>
                </div>
              </div>

              <hr className="divider" />

              {!submitted ? (
                <>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Your prediction for next 24h
                  </div>

                  <div className="predict-grid">
                    {options.map((o) => (
                      <div
                        key={o.dir}
                        className={`predict-btn ${selected === o.dir ? o.cls : ""}`}
                        onClick={() => setSelected(o.dir)}
                      >
                        <div className="predict-arrow" style={{
                          color: o.dir === "up" ? "var(--green)" : o.dir === "down" ? "var(--red)" : "var(--amber)",
                        }}>
                          {o.arrow}
                        </div>
                        <div className="predict-label">{o.label}</div>
                        <div className="predict-sub">{o.sub}</div>
                      </div>
                    ))}
                  </div>

                  {selected && (
                    <div style={{ marginTop: "1rem" }}>
                      <div style={{
                        background: "var(--amber-glow)", border: "1px solid #f5a62330",
                        borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 12,
                        fontFamily: "var(--mono)", fontSize: 13, color: "var(--amber)",
                      }}>
                        Prediction: <strong>{options.find(o => o.dir === selected)?.label}</strong> · Snapshot locked at UTC 00:00
                      </div>

                      {error && (
                        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10, fontFamily: "var(--mono)" }}>
                          ✗ {error}
                        </div>
                      )}

                      <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={loading}>
                        {loading ? "Submitting…" : "Submit prediction on-chain ↗"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ background: "#4ade8010", border: "1px solid #4ade8040", borderRadius: "var(--radius)", padding: "1rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>✓ Prediction submitted on-chain</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text2)" }}>
                    Tx: {txDigest ? `${txDigest.slice(0, 16)}…` : "pending"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                    Result verifiable at UTC 00:00 tomorrow
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Verification Flow</div>
              {[
                ["Submit",  "Your direction + timestamp recorded on-chain",   "badge-amber"],
                ["Oracle",  "Pyth Network posts SUI/USD at next UTC 00:00",   "badge-blue" ],
                ["Grade",   "Contract compares direction to actual movement",  "badge-amber"],
                ["Update",  "Streak NFT increments or resets automatically",  "badge-green"],
              ].map(([step, desc, badge]) => (
                <div key={step} className="row" style={{ padding: "8px 0", gap: 12, borderBottom: "1px solid var(--border)" }}>
                  <span className={`badge ${badge}`} style={{ minWidth: 64, justifyContent: "center" }}>{step}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{desc}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}