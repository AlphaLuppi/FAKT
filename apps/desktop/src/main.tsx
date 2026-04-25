import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./styles/globals.css";
import "./styles/responsive.css";
import "@fakt/ui/styles.css";
import { App } from "./App.js";
import { bootstrapRenderStrategy } from "./utils/render-bootstrap.js";

// Bootstrap : sur web, redirige le rendu PDF vers POST /api/render/pdf.
// Sur desktop, garde la stratégie par défaut (invoke Tauri).
bootstrapRenderStrategy();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
