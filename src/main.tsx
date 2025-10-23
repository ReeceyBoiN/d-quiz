import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ExternalDisplayWindow } from "./components/ExternalDisplayWindow";
import { SettingsProvider } from "./utils/SettingsContext";
import "./index.css";

// Detect if this is an external display window
// Check query params, hash, and window name
const urlParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.substring(1));

const isExternal =
  urlParams.get('external') === '1' ||
  urlParams.get('external') === 'true' ||
  hashParams.get('external') === '1' ||
  hashParams.get('external') === 'true' ||
  window.name === 'externalDisplay';

// Debug logging
console.log('main.tsx init:', {
  search: window.location.search,
  hash: window.location.hash,
  windowName: window.name,
  urlParamsExternal: urlParams.get('external'),
  hashParamsExternal: hashParams.get('external'),
  isExternal
});

createRoot(document.getElementById("root")!).render(
  isExternal ? (
    <SettingsProvider>
      <ExternalDisplayWindow />
    </SettingsProvider>
  ) : (
    <App />
  )
);
