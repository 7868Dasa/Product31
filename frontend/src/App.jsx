import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/useSession.js';
import { Landing } from './pages/Landing.jsx';
import { Login } from './pages/Login.jsx';
import { ShopList } from './pages/ShopList.jsx';
import { ShopDetail } from './pages/ShopDetail.jsx';
import { Account } from './pages/Account.jsx';
import { Dashboard } from './pages/shopkeeper/Dashboard.jsx';
import { Onboarding } from './pages/shopkeeper/Onboarding.jsx';
import { Poster } from './pages/shopkeeper/Poster.jsx';

const DEMO = import.meta.env.VITE_DEMO === 'true';

export default function App() {
  const { user, setUser, loading, signOut } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-ink-soft">…</div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Shopper — browsing is public (spec §11) */}
        <Route
          path="/login"
          element={user ? <Navigate to="/shops" replace /> : <Login onSignedIn={setUser} />}
        />
        <Route path="/shops" element={<ShopList user={user} />} />
        <Route path="/s/:slug" element={<ShopDetail user={user} />} />
        <Route
          path="/account"
          element={
            user ? <Account user={user} onSignOut={signOut} /> : <Navigate to="/login" replace />
          }
        />

        {/* Shopkeeper */}
        <Route path="/shop" element={<Dashboard />} />
        <Route path="/shop/onboarding" element={<Onboarding user={user} onSignedIn={setUser} />} />

        {/* Public printable poster (spec §11.1) */}
        <Route path="/p/:slug" element={<Poster />} />

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
