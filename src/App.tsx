import { useEffect, Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ROUTES } from "./constants/routes";

import Navbar from "./components/layout/Navbar";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const CinematicLanding = lazy(() => import("./components/landing/CinematicLanding"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const DeploymentConsolePage = lazy(() => import("./pages/DeploymentConsolePage"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));

function RouteLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}
export default function App() {
  const location = useLocation();

  // Smooth scroll helper
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Scroll to hash target or reset scroll position on view transitions
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] flex flex-col relative overflow-x-clip selection:bg-blue-600/30 selection:text-white transition-colors duration-300">
      {/* Decorative Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-sky-500/10 dark:bg-slate-800/15 rounded-full blur-[120px]"></div>
      </div>

      {/* Universal Responsive Navbar */}
      <Navbar scrollToSection={scrollToSection} />

      {/* Render Active View via React Router v7 */}
      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route
          path={ROUTES.HOME}
          element={<CinematicLanding />}
        />

        <Route
          path={ROUTES.LOGIN}
          element={
            <div className="flex flex-col flex-grow">
              <Login />
            </div>
          }
        />

        <Route
          path={ROUTES.SIGNUP}
          element={
            <div className="flex flex-col flex-grow">
              <Signup />
            </div>
          }
        />
        <Route
  path="/verify-email"
  element={
    <div className="flex flex-col flex-grow">
      <VerifyEmail />
    </div>
  }
/>

<Route
  path="/reset-password"
  element={
    <div className="flex flex-col flex-grow">
      <ResetPassword />
    </div>
  }
/>
<Route
  path="/forgot-password"
  element={
    <div className="flex flex-col flex-grow">
      <ForgotPassword />
    </div>
  }
/>
<Route
  path="/oauth/callback"
  element={
    <div className="flex flex-col flex-grow">
      <OAuthCallback />
    </div>
  }
/>

        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROFILE}
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/deployments/:deploymentId"
          element={
            <ProtectedRoute>
              <DeploymentConsolePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deployments/:deploymentId"
          element={
            <ProtectedRoute>
              <DeploymentConsolePage />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </div>
  );
}
