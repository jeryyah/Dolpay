import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { ErrorBoundary, installGlobalErrorHandlers } from "./components/error-boundary";
import { seedCustomProductsIfMissing } from "./lib/seed-custom-products";
import { startCloudSync } from "./lib/cloud-sync";

installGlobalErrorHandlers();
seedCustomProductsIfMissing();
// Start global cross-device sync. Pushes every whitelisted localStorage
// change to the /api/sync Netlify Function and pulls remote updates every
// 2s, so admin actions (orders, stock, prices, broadcasts, etc.) reach
// every connected buyer in near real-time.
startCloudSync(2000);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
