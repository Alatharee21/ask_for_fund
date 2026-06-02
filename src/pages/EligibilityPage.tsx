import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { PACKAGE_ID } from "../sdk/ask_for_fund-sdk";

interface ProfileData {
  streak: number;
  bestStreak: number;
  totalCorrect: number;
  totalSubmitted: number;
  isSettled: boolean;
}

const MOCK_STREAK_HISTORY = [
  { day: 1,  result: "correct" },
  { day: 2,  result: "correct" },
  { day: 3,  result: "correct" },
  { day: 4,  result: "wrong"   },
  { day: 5,  result: "correct" },
  { day: 6,  result: "correct" },
  { day: 7,  result: "correct" },
  { day: 8,  result: "correct" },
  { day: 9,  result: "correct" },
  { day: 10, result: "today"   },
  { day: 11, result: "pending" },
  { day: 12, result: "pending" },
  { day: 13, result: "pending" },
  { day: 14, result: "pending" },
];

export default function EligibilityPage() {
  const account = useCurrentAccount();
  const client  = useSuiClient();

  const [balance, setBalance] = useState<number | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  const MIN_BALANCE_SUI = 100;
  const MIN_STREAK      = 7;

  useEffect(() => {
    if (!account) return;
    setLoading(true);

    client
      .getBalance({ owner: account.address, coinType: "0x2::sui::SUI" })
      .then((b) => setBalance(Number(b.totalBalance) / 1_000_000_000))
      .catch(() => setBalance(0));

    client
      .getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::prediction::PredictionProfile` },
        options: { showContent: true },
      })
      .then((res) => {
        const obj = res.data[0];
        if (obj?.data?.content && "fields" in obj.data.content) {
          const f = (obj.data.content as any).fields;
          setProfile({
            streak:         Number(f.streak),
            bestStreak:     Number(f.best_streak),
            totalCorrect:   Number(f.total_correct),
            totalSubmitted: Number(f.total_submitted),
            isSettled:      f.pending_settled,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [account]);

  const balanceOk     = balance !== null && balance >= MIN_BALANCE_SUI;
  const streakOk      = profile !== null && profile.streak >= MIN_STREAK;
  const fullyEligible = balanceOk && streakOk;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-eyebrow">Step 01</div>
        <div className="page-title">Eligibility Check</div>
        <div className="page-subtitle">
          Two on-chain requirements must be met before you can request a grant.
        </div>
      </div>

      <div className="page-body">
        {!account ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
            <div style={{ color: "var(--text2)" }}>Connect your wallet to check eligibility</div>
          </div>
        ) : (
          <>
            <div className="card" style={{
              border: fullyEligible ? "1px solid #4ade8040" : "1px solid #f5a62340",
              background: fullyEligible ? "#4ade8008" : "#f5a62308",
              marginBottom: "1.5rem",
            }}>
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                    {fullyEligible ? "✓ Fully eligible" : "Requirements in progress"}
                  </div>
                  <div className="muted">
                    {fullyEligible
                      ? "You can now submit a grant request."
                      : "Complete both checks below to unlock the grant request page."}
                  </div>
                </div>
                <span className={`badge ${fullyEligible ? "badge-green" : "badge-amber"}`}>
                  {fullyEligible ? "Unlocked" : "Pending"}
                </span>
              </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-box">
                <div className="stat-label">Wallet Balance</div>
                <div className={`stat-value ${balanceOk ? "green" : "red"}`}>
                  {loading ? "—" : balance !== null ? balance.toFixed(1) : "0"}
                  <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4 }}>SUI</span>
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Min Required</div>
                <div className="stat-value">
                  {MIN_BALANCE_SUI}
                  <span style={{ fontSize: 13, fontWeight: 400 }}> SUI</span>
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Current Streak</div>
                <div className={`stat-value ${streakOk ? "green" : "amber"}`}>
                  {loading ? "—" : profile?.streak ?? 0}
                  <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text3)", marginLeft: 4 }}>
                    / {MIN_STREAK}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Requirements</div>
              <div className="row-between" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Minimum SUI balance</div>
                  <div className="muted">Wallet must hold ≥ {MIN_BALANCE_SUI} SUI at time of request</div>
                </div>
                <span className={`badge ${balanceOk ? "badge-green" : "badge-red"}`}>
                  {balanceOk ? "✓ Passed" : "✗ Failed"}
                </span>
              </div>
              <div className="row-between" style={{ padding: "10px 0" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Prediction streak</div>
                  <div className="muted">{MIN_STREAK} consecutive correct daily predictions required</div>
                </div>
                <span className={`badge ${streakOk ? "badge-green" : "badge-amber"}`}>
                  {streakOk ? "✓ Passed" : `Day ${profile?.streak ?? 0} of ${MIN_STREAK}`}
                </span>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Streak History</div>
              <div className="muted" style={{ marginBottom: "1rem", fontSize: 13 }}>
                Daily SUI price direction predictions. A wrong answer resets your active streak.
              </div>
              <div className="streak-row">
                {MOCK_STREAK_HISTORY.map((d) => (
                  <div key={d.day} className={`streak-dot ${d.result}`} title={`Day ${d.day}`}>
                    {d.result === "correct" && "✓"}
                    {d.result === "wrong"   && "✗"}
                    {d.result === "today"   && "!"}
                    {d.result === "pending" && "·"}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8, fontFamily: "var(--mono)" }}>
                Active streak: {profile?.streak ?? 5} consecutive correct — need {Math.max(0, MIN_STREAK - (profile?.streak ?? 5))} more
              </div>
            </div>

            <div className="card">
              <div className="card-title">How Verification Works</div>
              {[
                ["01", "Submit direction", "You pick UP / FLAT / DOWN on-chain each day with a gas fee"],
                ["02", "Oracle settles",   "Pyth Network posts SUI/USD price at UTC 00:00"],
                ["03", "Auto-graded",      "Smart contract compares your direction against actual movement"],
                ["04", "Streak updates",   "Your on-chain profile NFT updates — streak or reset"],
              ].map(([n, title, desc]) => (
                <div key={n} className="row" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", gap: 16 }}>
                  <div className="mono" style={{ color: "var(--amber)", fontSize: 12, minWidth: 24 }}>{n}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}