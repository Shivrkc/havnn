import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/project.routes";
import githubRoutes from "./routes/github.routes";
import healthRoutes from "./routes/health.routes";
import deploymentRoutes from "./routes/deployment.routes";

const app = express();

// Configure reverse proxy trust if explicitly enabled
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv) {
  if (trustProxyEnv === "true" || trustProxyEnv === "1") {
    app.set("trust proxy", 1);
  } else if (!isNaN(Number(trustProxyEnv))) {
    app.set("trust proxy", Number(trustProxyEnv));
  } else {
    app.set("trust proxy", trustProxyEnv);
  }
} else {
  app.set("trust proxy", false);
}

// Disable information disclosure
app.disable("x-powered-by");

// Standard security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Restrict CORS origins
app.use(
  cors({
    origin: (origin, callback) => {
      const configuredFrontend = process.env.FRONTEND_URL || "http://localhost:3000";
      const allowLocalhost = process.env.NODE_ENV !== "production";

      // Allow requests with no origin (curl, mobile, server-to-server) or configured frontend
      // Allow localhost/127.0.0.1 loopback only outside production
      if (
        !origin ||
        origin === configuredFrontend ||
        (allowLocalhost &&
          (origin.startsWith("http://localhost:") ||
            origin.startsWith("http://127.0.0.1:")))
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation: Access denied from this origin."));
    },
    credentials: true,
  })
);

// Explicit JSON request body size limit (1MB) to prevent payload exhaustion attacks
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/deployments", deploymentRoutes);

export default app;