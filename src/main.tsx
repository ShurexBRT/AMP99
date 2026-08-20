import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./legacy-skin.css";
import "./classic-fidelity.css";
import "./spotify-ui.css";
import "./native-windows.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
