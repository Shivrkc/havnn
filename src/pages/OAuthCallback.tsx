import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeOAuthCode } from "../services/auth.service";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasExchangedRef = useRef(false);

  useEffect(() => {
    if (hasExchangedRef.current) return;

    const code = searchParams.get("code");
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, {
        replace: true,
      });
      return;
    }

    if (code) {
      hasExchangedRef.current = true;
      exchangeOAuthCode(code)
        .then((data) => {
          if (data?.token) {
            localStorage.setItem("token", data.token);
            navigate("/dashboard", { replace: true });
          } else {
            navigate("/login?error=auth_failed", { replace: true });
          }
        })
        .catch(() => {
          navigate("/login?error=auth_failed", { replace: true });
        });
      return;
    }

    // Fallback for legacy direct token in query string
    if (token) {
      hasExchangedRef.current = true;
      localStorage.setItem("token", token);
      navigate("/dashboard", {
        replace: true,
      });
      return;
    }

    navigate("/login?error=auth_failed", {
      replace: true,
    });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-medium">
          Signing you in...
        </p>
      </div>
    </div>
  );
};

export default OAuthCallback;