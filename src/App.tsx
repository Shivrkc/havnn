import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ROUTES } from "./constants/routes";

import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";

import Hero from "./components/landing/Hero";
import Features from "./components/landing/Features";
import WhyChooseUs from "./components/landing/WhyChooseUs";
import Faq from "./components/landing/Faq";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import OAuthCallback from "./pages/OAuthCallback";
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
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] flex flex-col relative overflow-hidden selection:bg-blue-600/30 selection:text-white transition-colors duration-300">
      {/* Decorative Background Glows */}
      <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-sky-500/10 dark:bg-slate-800/15 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Universal Responsive Navbar */}
      <Navbar scrollToSection={scrollToSection} />

      {/* Render Active View via React Router v7 */}
      <Routes>
        <Route
          path={ROUTES.HOME}
          element={
            <div className="flex flex-col">
              <Hero />
              <Features />
              <WhyChooseUs />
              <Faq />
              <Footer />
            </div>
          }
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
      </Routes>
    </div>
  );
}
