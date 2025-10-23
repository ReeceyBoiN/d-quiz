import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ExternalDisplayWindow } from "./components/ExternalDisplayWindow";
import "./index.css";

const params = new URLSearchParams(window.location.search);
const isExternal = params.get('external') === '1' || params.get('external') === 'true';

createRoot(document.getElementById("root")!).render(
  isExternal ? <ExternalDisplayWindow /> : <App />
);
