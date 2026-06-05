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

    // Fetch SUI balance
    client
      .getBalance({ owner: account.address, coinType: "0x2::sui::SUI" })
      .then((b) => setBalance(Number(b.totalBalance) / 1_000_000_000))
      .catch(() => setBalance(0));

    // Fetch prediction profile
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
        } else {
          // Profile exists but no data yet — set all zeros
          setProfile({
            streak: 0, bestStreak: 0,
            totalCorrect: 0, totalSubmitted: 0,
            isSettled: true,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [account]);

  const balanceOk     = balance !== null && balance >= MIN_BALANCE_SUI;
  const streakOk      = profile !== null && profile.streak >= MIN_STREAK;
  const fullyEligible = balanceOk && streakOk;

  // Build streak history dynamically from real data
  const buildStreakHistory = () => {
    if (!profile) return [];

    const total     = profile.totalSubmitted;
    const correct   = profile.totalCorrect;
    const wrong     = total - correct;
    const streak    = profile.streak;
    const history   = [];

    // Fill correct days based on current streak at the end
    // Fill wrong days before the streak
    const wrongDays   = Math.max(0, total - streak);
    const correctDays = streak;

    for (let i = 0; i < wrongDays; i++) {
      history.push({ day: i + 1, result: "wrong" });
    }
    for (let i = 0; i < correctDays; i++) {
      history.push({ day: wrongDays + i + 1, result: "correct" });
    }

    // Today slot
    if (profile.isSettled) {
      history.push({ day: total + 1, result: "today" });
    }

    // Pending future days to show target
    const remaining = Math.max(0, MIN_STREAK - streak);
    for (let i = 0; i < remaining; i++) {
      history.push({ day: total + i + 2, result: "pending" });
    }

    return history;
  };

  const streakHistory = buildStreakHistory();

  return (
    <div className="page-enter">
      <div className="page-header">
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
            {/* Status banner */}
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

            {/* Stats */}
            <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-box">
                <div className="stat-label">Wallet Balance</div>
                <div className={`stat-value ${balanceOk ? "green" : "red"}`}>
                  {loading ? "—" : balance !== null ? balance.toFixed(2) : "0"}
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

            {/* Requirements */}
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

            {/* Streak history */}
            <div className="card">
              <div className="card-title">Streak History</div>
              <div className="muted" style={{ marginBottom: "1rem", fontSize: 13 }}>
                Daily SUI price direction predictions. A wrong answer resets your active streak.
              </div>

              {profile?.totalSubmitted === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "var(--text3)",
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--radius)",
                }}>
                  No predictions yet — go to the Predict page to start your streak
                </div>
              ) : (
                <>
                  <div className="streak-row">
                    {streakHistory.map((d, i) => (
                      <div
                        key={i}
                        className={`streak-dot ${d.result}`}
                        title={`Day ${d.day}`}
                      >
                        {d.result === "correct" && "✓"}
                        {d.result === "wrong"   && "✗"}
                        {d.result === "today"   && "!"}
                        {d.result === "pending" && "·"}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8, fontFamily: "var(--mono)" }}>
                    Active streak: {profile?.streak ?? 0} consecutive correct
                    {profile && profile.streak < MIN_STREAK && ` — need ${MIN_STREAK - profile.streak} more`}
                    {profile && profile.streak >= MIN_STREAK && " — qualified!"}
                  </div>
                </>
              )}
            </div>

            {/* Stats breakdown */}
            {profile && profile.totalSubmitted > 0 && (
              <div className="card">
                <div className="card-title">Prediction Stats</div>
                <div className="stat-grid">
                  <div className="stat-box">
                    <div className="stat-label">Total Submitted</div>
                    <div className="stat-value">{profile.totalSubmitted}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Total Correct</div>
                    <div className="stat-value green">{profile.totalCorrect}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Accuracy</div>
                    <div className="stat-value amber">
                      {Math.round((profile.totalCorrect / profile.totalSubmitted) * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}