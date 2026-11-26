import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { loadPlatform } from "./platform";
import { renderStartupError } from "./startupError";

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
    renderStartupError(root, err);
  });
