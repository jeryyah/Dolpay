import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { ErrorBoundary, installGlobalErrorHandlers } from "./components/error-boundary";
import { seedCustomProductsIfMissing } from "./lib/seed-custom-products";
import { primeCloudSync, startCloudSync } from "./lib/cloud-sync";

installGlobalErrorHandlers();
seedCustomProductsIfMissing();

const root = createRoot(document.getElementById("root")!);

// Pull the latest world snapshot from the server BEFORE first render so
// brand-new visitors see the exact same products / payment / prices that
// admin has set, instead of stale seed defaults. Wait at most 1.5s; if
// the network is unreachable we render anyway with the local cache and
// reconcile as soon as the next pull succeeds.
primeCloudSync(1500).finally(() => {
  startCloudSync(2000);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
});
