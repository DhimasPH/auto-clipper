import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { loadPlatform } from "./platform";

const root = document.getElementById("root")!;

loadPlatform()
  .then(() => {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error("Platform failed to load:", err);
    root.textContent =
      "Auto Clipper tidak bisa dimulai. Muat ulang halaman ini. / Auto Clipper could not start. Reload this page.";
  });
