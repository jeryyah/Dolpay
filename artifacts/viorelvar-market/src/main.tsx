import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { ErrorBoundary, installGlobalErrorHandlers } from "./components/error-boundary";
import { seedCustomProductsIfMissing } from "./lib/seed-custom-products";

installGlobalErrorHandlers();
seedCustomProductsIfMissing();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
