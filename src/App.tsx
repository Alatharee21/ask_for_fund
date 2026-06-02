import { Routes, Route, NavLink } from "react-router-dom";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import EligibilityPage  from "./pages/EligibilityPage";
import PredictPage      from "./pages/PredictPage";
import RequestPage      from "./pages/RequestPage";
import FundVaultPage    from "./pages/FundVaultPage";
import ReviewGrantsPage from "./pages/ReviewGrantsPage";

const NAV = [
  {
    section: "Applicant",
    links: [
      { to: "/",         label: "Eligibility",  icon: "⬡" },
      { to: "/predict",  label: "Predict",       icon: "◈" },
      { to: "/request",  label: "Request Grant", icon: "◎" },
    ],
  },
  {
    section: "Funder",
    links: [
      { to: "/vault",    label: "Fund Vault",    icon: "◆" },
      { to: "/review",   label: "Review Grants", icon: "◇" },
    ],
  },
];

export default function App() {
  const account = useCurrentAccount();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">on sui</div>
          <div className="logo-name">SuiGrant</div>
        </div>

        <nav className="nav-section">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="nav-label">{group.section}</div>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                >
                  <span style={{ fontSize: 14 }}>{link.icon}</span>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="wallet-btn-wrap">
            <ConnectButton />
          </div>
          {account && (
            <div className="mono muted" style={{ fontSize: 11, marginTop: 8, wordBreak: "break-all" }}>
              {account.address.slice(0, 6)}…{account.address.slice(-4)}
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/"        element={<EligibilityPage />} />
          <Route path="/predict" element={<PredictPage />} />
          <Route path="/request" element={<RequestPage />} />
          <Route path="/vault"   element={<FundVaultPage />} />
          <Route path="/review"  element={<ReviewGrantsPage />} />
        </Routes>
      </main>
    </div>
  );
}