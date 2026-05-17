import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import cors from "cors";
import fs from "fs";

// Load Firebase Config safely
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

// Initialize Firebase Admin
function initializeFirebase() {
  if (admin.apps.length > 0) return;

  console.log("Starting Firebase Admin initialization...");

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      let jsonContent = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      
      if (jsonContent.startsWith("'") && jsonContent.endsWith("'")) {
        jsonContent = jsonContent.slice(1, -1);
      }
      
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(jsonContent);
      } catch (parseError) {
        console.warn("Retrying FIREBASE_SERVICE_ACCOUNT_JSON parse with escaped newlines...");
        const escapedContent = jsonContent.replace(/\n/g, "\\n");
        serviceAccount = JSON.parse(escapedContent);
      }

      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin initialized successfully using service account JSON");
      return;
    } catch (e) {
      console.error("Failed to initialize with service account JSON:", e);
    }
  }

  // Fallback 1: Application Default
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId
    });
    console.log("Firebase Admin initialized with application default credentials");
    return;
  } catch (e: any) {
    console.warn("Application Default initialization failed:", e.message);
  }

  // Fallback 2: Basic Project ID init (Limited functionality)
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("Firebase Admin initialized with only Project ID (limited functionality)");
  } catch (e) {
    console.error("Ultimate fallback initialization failed:", e);
  }
}

initializeFirebase();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");

  app.use(express.json());
  app.use(cors());

  // Request logger for debugging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
