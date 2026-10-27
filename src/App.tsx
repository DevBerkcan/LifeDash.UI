import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./components/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";

// Pages load on first visit so the initial bundle (and the login screen) stays small.
const Authorities = lazy(() => import("./pages/Authorities"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Deliveries = lazy(() => import("./pages/Deliveries"));
const Documents = lazy(() => import("./pages/Documents"));
const Family = lazy(() => import("./pages/Family"));
const Finance = lazy(() => import("./pages/Finance"));
const Mail = lazy(() => import("./pages/Mail"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Termine = lazy(() => import("./pages/Termine"));
const Travel = lazy(() => import("./pages/Travel"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Savings = lazy(() => import("./pages/Savings"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const WishList = lazy(() => import("./pages/WishList"));

export default function App() {
  const { session, ready } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  if (!ready) return <div className="auth"><p className="lede">Wird geladen …</p></div>;

  return (
    <Suspense fallback={<div className="auth"><p className="lede">Wird geladen …</p></div>}>
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

      {session ? (
        <Route element={<Layout alertCount={alertCount} />}>
          <Route index element={<Dashboard onCount={setAlertCount} />} />
          <Route path="family" element={<Family />} />
          <Route path="termine" element={<Termine />} />
          <Route path="authorities" element={<Authorities />} />
          <Route path="authorities/:id" element={<Authorities />} />
          <Route path="finance" element={<Finance />} />
          <Route path="savings" element={<Savings />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="wishlist" element={<WishList />} />
          <Route path="travel" element={<Travel />} />
          <Route path="travel/:id" element={<Travel />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/:id" element={<Documents />} />
          <Route path="mail" element={<Mail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Login />} />
      )}
    </Routes>
    </Suspense>
  );
}
