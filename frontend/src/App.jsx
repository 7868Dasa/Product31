import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSession } from './lib/useSession.js';
import { needsConsent } from './lib/consent.js';
import { Landing } from './pages/Landing.jsx';
import { Login } from './pages/Login.jsx';
import { Consent } from './pages/Consent.jsx';
import { ShopList } from './pages/ShopList.jsx';
import { ShopDetail } from './pages/ShopDetail.jsx';
import { Orders } from './pages/Orders.jsx';
import { SpendReport } from './pages/SpendReport.jsx';
import { SpendReportPrint } from './pages/SpendReportPrint.jsx';
import { Account } from './pages/Account.jsx';
import { Dashboard } from './pages/shopkeeper/Dashboard.jsx';
import { Onboarding } from './pages/shopkeeper/Onboarding.jsx';
import { Poster } from './pages/shopkeeper/Poster.jsx';
import { Privacy } from './pages/legal/Privacy.jsx';
import { Terms } from './pages/legal/Terms.jsx';
import { Security } from './pages/legal/Security.jsx';

const DEMO = import.meta.env.VITE_DEMO === 'true';

export default function App() {
  const { user, setUser, loading, signOut } = useSession();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-ink-soft">…</div>
    );
  }

  // DPDP: a signed-in user must record consent before doing anything else.
  const gateConsent =
    needsConsent(user) && pathname !== '/consent' && !pathname.startsWith('/legal');
  if (gateConsent) {
    return (
      <Routes>
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="*" element={<Consent user={user} onUpdated={setUser} />} />
      </Routes>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route
          path="/login"
          element={user ? <Navigate to="/shops" replace /> : <Login onSignedIn={setUser} />}
        />
        <Route
          path="/consent"
          element={user ? <Consent user={user} onUpdated={setUser} /> : <Navigate to="/login" replace />}
        />
        <Route path="/shops" element={<ShopList user={user} />} />
        <Route path="/s/:slug" element={<ShopDetail user={user} />} />
        <Route path="/orders" element={<Orders user={user} />} />
        <Route path="/orders/report" element={<SpendReport user={user} />} />
        <Route path="/orders/report/print" element={<SpendReportPrint user={user} />} />
        <Route
          path="/account"
          element={
            user ? (
              <Account user={user} onSignOut={signOut} onUserUpdated={setUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Shopkeeper */}
        <Route path="/shop" element={<Dashboard />} />
        <Route path="/shop/onboarding" element={<Onboarding user={user} onSignedIn={setUser} />} />

        {/* Public */}
        <Route path="/p/:slug" element={<Poster />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="/legal/security" element={<Security />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {DEMO && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 bg-ink/90 px-4 py-2 text-center text-xs font-semibold text-cream print:hidden">
          DEMO MODE · no backend · phone: any 10 digits · code 123456
        </div>
      )}
    </>
  );
}
