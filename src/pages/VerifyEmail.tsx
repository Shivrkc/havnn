import { useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { verifyEmail } from "../services/auth.service";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<
    "loading" | "success" | "error"
  >("loading");

  const [message, setMessage] = useState("");

  // Prevent duplicate verification requests in React StrictMode
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (verificationStarted.current) {
      return;
    }

    verificationStarted.current = true;

    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyEmail(token);

        setStatus("success");
        setMessage(
          result?.message || "Email verified successfully."
        );
      } catch (error: any) {
        setStatus("error");
        setMessage(
          error?.response?.data?.message ||
            "Invalid or expired verification link."
        );
      }
    };

    verify();
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-6 selection:bg-blue-600/30 selection:text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/80 dark:border-[#282d37] bg-white/70 dark:bg-[#16191f]/90 backdrop-blur-2xl shadow-2xl dark:shadow-black/60 p-8 text-center">

        {/* Loading */}
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-blue-600 dark:text-blue-400 animate-spin" />

            <h1 className="mt-6 text-2xl font-extrabold text-slate-900 dark:text-[#f1f3f5]">
              Verifying your email
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <CheckCircle className="w-14 h-14 mx-auto text-emerald-500" />

            <h1 className="mt-6 text-2xl font-extrabold text-slate-900 dark:text-[#f1f3f5]">
              Email verified!
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {message}
            </p>

            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className="mt-7 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all cursor-pointer"
            >
              Go to Login
            </button>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <XCircle className="w-14 h-14 mx-auto text-red-500" />

            <h1 className="mt-6 text-2xl font-extrabold text-slate-900 dark:text-[#f1f3f5]">
              Verification failed
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {message}
            </p>

            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className="mt-7 w-full bg-slate-900 dark:bg-[#1e222b] hover:bg-slate-800 dark:hover:bg-[#252a35] text-white font-bold text-sm py-3 rounded-xl border border-transparent dark:border-[#282d37] transition-all cursor-pointer"
            >
              Go to Login
            </button>
          </>
        )}

      </div>
    </main>
  );
}