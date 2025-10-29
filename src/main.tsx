import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ExternalDisplayWindow } from "./components/ExternalDisplayWindow";
import { SettingsProvider } from "./utils/SettingsContext";
import "./index.css"; // ✅ Ensure Tailwind is loaded

// ============================================================
// ✅ Detect if this window is the external display
// ============================================================
const urlParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.substring(1));

const isExternal =
  urlParams.get("external") === "1" ||
  urlParams.get("external") === "true" ||
  hashParams.get("external") === "1" ||
  hashParams.get("external") === "true" ||
  window.name === "externalDisplay";

// Optional: debug info
if (import.meta.env.DEV) {
  console.log("[main.tsx] Window context:", {
    search: window.location.search,
    hash: window.location.hash,
    windowName: window.name,
    isExternal,
  });
}

// ============================================================
// ✅ Render either the main app or external display window
// ============================================================
const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("❌ Root element not found: #root");
} else {
  const root = ReactDOM.createRoot(rootElement);

  if (isExternal) {
    // 🖥️ External display mode
    root.render(
      <React.StrictMode>
        <SettingsProvider>
          <ExternalDisplayWindow />
        </SettingsProvider>
      </React.StrictMode>
    );
  } else {
    // 🧠 Main app mode
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}
