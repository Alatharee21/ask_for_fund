import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { buildSubmitPredictionTx, Direction, PACKAGE_ID } from "../sdk/ask_for_fund-sdk";
import { parseError } from "../utils/errors";

type PredDir = "up" | "flat" | "down" | null;

export default function PredictPage() {
  const account = useCurrentAccount();
  const client  = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [selected,  setSelected]  = useState<PredDir>(null);
  const [submitted, setSubmitted] = useState(false);
  const [txDigest,  setTxDigest]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<"checking" | "creating" | "exists" | "error">("checking");
  const [price,     setPrice]     = useState<number | null>(null);
const [change,    setChange]    = useState<number | null>(null);
const [priceLoad, setPriceLoad] = useState(true);
const [streak,      setStreak]      = useState<number>(0);
const [bestStreak,  setBestStreak]  = useState<number>(0);
const [totalCorrect, setTotalCorrect] = useState<number>(0);
const [totalSubmitted, setTotalSubmitted] = useState<number>(0);

// SUI/USD Pyth feed ID
const SUI_FEED_ID = "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744";

const [alreadyPredicted, setAlreadyPredicted] = useState(false);
const [pendingSettled,   setPendingSettled]   = useState(true);

useEffect(() => {
  if (!account) return;
  setProfileStatus("checking");

  // Poll every 2 seconds until profile is found
  const interval = setInterval(() => {
    client.getOwnedObjects({
      owner: account.address,
      filter: { StructType: `${PACKAGE_ID}::prediction::PredictionProfile` },
      options: { showContent: false },
    }).then((res) => {
      const existing = res.data[0]?.data?.objectId ?? null;
      if (existing) {
        setProfileId(existing);
        setProfileStatus("exists");
        clearInterval(interval); // stop polling once found
      } else {
        setProfileStatus("creating"); // still waiting
      }
    }).catch(() => {
      setProfileStatus("error");
      clearInterval(interval);
    });
  }, 100000);

  // Cleanup on unmount
  return () => clearInterval(interval);
}, [account]);

  const directionMap: Record<NonNullable<PredDir>, Direction> = {
    up: Direction.UP, flat: Direction.FLAT, down: Direction.DOWN,
  };


useEffect(() => {
  const fetchPrice = async () => {
    try {
      const res = await fetch(
        `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SUI_FEED_ID}`
      );
      const data = await res.json();
      const feed = data.parsed[0];

      const rawPrice = feed.price.price;
      const expo     = feed.price.expo;
      const current  = rawPrice * Math.pow(10, expo);

      const rawPrev  = feed.ema_price.price;
      const prev     = rawPrev * Math.pow(10, expo);
      const pctChange = ((current - prev) / prev) * 100;

      setPrice(current);
      setChange(pctChange);
      setPriceLoad(false);
    } catch (e) {
      console.error("Price fetch failed:", e);
      setPriceLoad(false);
    }
  };

  fetchPrice();

  // Refresh every 30 seconds
  const interval = setInterval(fetchPrice, 30_000);
  return () => clearInterval(interval);
}, []);
  

useEffect(() => {
  const checkProfile = () => {
  if (!account) {
    setProfileStatus("error");
    return;
  }
  setProfileStatus("checking");
  client.getOwnedObjects({
    owner: account.address,
    filter: { StructType: `${PACKAGE_ID}::prediction::PredictionProfile` },
    options: { showContent: true },  // ← change false to true
  }).then((res) => {
    const obj = res.data[0];
    if (obj?.data?.objectId) {
      setProfileId(obj.data.objectId);
      setProfileStatus("exists");

      // Extract streak data from the profile fields
      // Inside checkProfile, after fetching profile fields:
if (obj.data.content && "fields" in obj.data.content) {
  const f        = (obj.data.content as any).fields;
  const todayIdx = Math.floor(Date.now() / 86_400_000);

  setStreak(Number(f.streak));
  setBestStreak(Number(f.best_streak));
  setTotalCorrect(Number(f.total_correct));
  setTotalSubmitted(Number(f.total_submitted));
  setPendingSettled(f.pending_settled);
  setAlreadyPredicted(Number(f.last_day_index) === todayIdx);
}
    } else {
      setProfileStatus("creating");
    }
  }).catch(() => setProfileStatus("error"));
  };

  checkProfile();
}, [account, client]);

  const handleSubmit = async () => {
    if (!selected || !account || !profileId) {
      if (!profileId) setError("No prediction profile found");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const tx = buildSubmitPredictionTx(profileId, directionMap[selected]);

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
          setError(parseError(err.message)); 
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

          {profileStatus === "creating" && (
  <div className="card" style={{ border: "1px solid #f5a62340", background: "#f5a62308", marginBottom: "1rem" }}>
    <div style={{ fontWeight: 700, color: "var(--amber)", marginBottom: 4 }}>
      ⟳ Setting up your profile…
    </div>
    <div className="muted" style={{ fontSize: 13 }}>
      Please approve the wallet popup to create your prediction profile. This only happens once.
    </div>
  </div>
)}
            {/* Streak progress */}
<div className="card">
  <div className="row-between" style={{ marginBottom: 10 }}>
    <div className="card-title" style={{ marginBottom: 0 }}>Streak Progress</div>
    <span className="badge badge-amber">
      {streak} day{streak !== 1 ? "s" : ""} streak
    </span>
  </div>

  <div className="progress-wrap">
    <div
      className="progress-fill"
      style={{ width: profileId ? `${Math.min((streak / 7) * 100, 100)}%` : "0%" }}
    />
  </div>

  <div className="row-between" style={{ marginTop: 6 }}>
    <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>
      {streak} correct in a row
    </span>
    <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>
      {Math.max(0, 7 - streak)} more to qualify
    </span>
  </div>

  {/* Extra stats */}
  <hr className="divider" />
  <div style={{ display: "flex", gap: 24 }}>
    <div>
      <div className="stat-label">Best Streak</div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--amber)" }}>
        {bestStreak} days
      </div>
    </div>
    <div>
      <div className="stat-label">Total Correct</div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--green)" }}>
        {totalCorrect}
      </div>
    </div>
    <div>
      <div className="stat-label">Total Submitted</div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--text)" }}>
        {totalSubmitted}
      </div>
    </div>
    <div>
      <div className="stat-label">Accuracy</div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--blue)" }}>
        {totalSubmitted > 0 ? `${Math.round((totalCorrect / totalSubmitted) * 100)}%` : "—"}
      </div>
    </div>
  </div>
</div>

            {/* Market snapshot + prediction */}
            <div className="card">
              <div className="card-title">Sui Price</div>
              <div className="row-between">
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--mono)", letterSpacing: "-0.02em" }}>
                    {priceLoad ? "—" : `$${price?.toFixed(4)}`}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "var(--mono)" }}>SUI / USD</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: "var(--mono)",
                    color: change === null ? "var(--text3)" : change >= 0 ? "var(--green)" : "var(--red)",
                  }}>
                    {priceLoad ? "—" : `${change !== null && change >= 0 ? "+" : ""}${change?.toFixed(2)}%`}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>vs EMA</div>
                </div>
              </div>

              {/* Last updated timestamp */}
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)", marginTop: 6 }}>
                Updates every 30s
              </div>

              <hr className="divider" />

              {!submitted ? (
                <>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Your prediction for next 24h
                  </div>

                  {alreadyPredicted && (
  <div style={{
    background: "#f5a62310",
    border: "1px solid #f5a62340",
    borderRadius: "var(--radius)",
    padding: "10px 14px",
    marginBottom: 12,
    fontFamily: "var(--mono)",
    fontSize: 13,
    color: "var(--amber)",
  }}>
    ⚠ You already predicted today. Come back after UTC 00:00.
  </div>
)}

{!pendingSettled && (
  <div style={{
    background: "#f5a62310",
    border: "1px solid #f5a62340",
    borderRadius: "var(--radius)",
    padding: "10px 14px",
    marginBottom: 12,
    fontFamily: "var(--mono)",
    fontSize: 13,
    color: "var(--amber)",
  }}>
    ⚠ Your previous prediction has not been settled yet. Wait for the oracle to post today's price.
  </div>
)}

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
                        background: "var(--amber-glow)",
                        border: "1px solid #f5a62330",
                        borderRadius: "var(--radius)",
                        padding: "10px 14px",
                        marginBottom: 12,
                        fontFamily: "var(--mono)",
                        fontSize: 13,
                        color: "var(--amber)",
                      }}>
                        Prediction: <strong>{options.find(o => o.dir === selected)?.label}</strong> · Snapshot locked at UTC 00:00
                      </div>

                      {/* Profile ID confirmation */}
                      {profileId && (
                        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>
                          Profile: {profileId.slice(0, 10)}…{profileId.slice(-6)}
                        </div>
                      )}

                      {error && (
                        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10, fontFamily: "var(--mono)" }}>
                          ✗ {error}
                        </div>
                      )}

                      <button
  className="btn btn-primary btn-full"
  onClick={handleSubmit}
  disabled={loading || !profileId || profileStatus === "creating" || alreadyPredicted || !pendingSettled}
>
  {alreadyPredicted
    ? "Already predicted today"
    : !pendingSettled
    ? "Waiting for settlement…"
    : profileStatus === "creating"
    ? "Setting up profile…"
    : loading
    ? "Submitting…"
    : "Submit prediction on-chain ↗"}
</button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  background: "#4ade8010",
                  border: "1px solid #4ade8040",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                }}>
                  <div style={{ fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>
                    ✓ Prediction submitted on-chain
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text2)" }}>
                    Tx: {txDigest ? `${txDigest.slice(0, 16)}…` : "pending"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                    Result verifiable at UTC 00:00 tomorrow
                  </div>
                </div>
              )}
            </div>

            {/* Verification flow */}
            <div className="card">
              <div className="card-title">Verification Flow</div>
              {[
                ["Submit",  "Your direction + timestamp recorded on-chain",  "badge-amber"],
                ["Oracle",  "Pyth Network posts SUI/USD at next UTC 00:00",  "badge-blue" ],
                ["Grade",   "Contract compares direction to actual movement", "badge-amber"],
                ["Update",  "Streak NFT increments or resets automatically", "badge-green"],
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