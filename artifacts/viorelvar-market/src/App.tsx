import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { BroadcastNotification } from "@/components/broadcast-notification";
import { LivePurchaseToast } from "@/components/live-purchase-toast";
import { UpdateBanner } from "@/components/update-banner";
import { seedDummyOrdersIfEmpty } from "@/lib/seed-dummy";
import { AuroraBackground } from "@/components/aurora-background";
import { AdminModeBar } from "@/components/admin-mode-bar";
import { MaintenanceGate } from "@/components/maintenance-screen";
import { ScheduledAnnouncementBanner } from "@/components/scheduled-banner";
import { Eye, X } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ProductDetail from "@/pages/product-detail";
import History from "@/pages/history";
import Contact from "@/pages/contact";
import FAQ from "@/pages/faq";
import Developer from "@/pages/developer";
import Login from "@/pages/login";
import PaymentQRIS from "@/pages/payment-qris";
import PaymentUSDT from "@/pages/payment-usdt";
import Admin from "@/pages/admin";
import Profile from "@/pages/profile";
import Leaderboard from "@/pages/leaderboard";
import Garansi from "@/pages/garansi";
import ReplaceKeyPage from "@/pages/replace-key";
import BackupEmail from "@/pages/backup-email";
import Pin from "@/pages/pin";
import Wishlist from "@/pages/wishlist";
import NotificationsPage from "@/pages/notifications";
import ReferralPage from "@/pages/referral";
import ChatPage from "@/pages/chat";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const PUBLIC_PATHS = ["/login"];

const APP_VERSION = "v7-2026-04-24-tiers-invoiceid";

function ForceRelogin() {
  useEffect(() => {
    seedDummyOrdersIfEmpty();
    const seen = localStorage.getItem("pinz_app_version");
    if (seen !== APP_VERSION) {
      localStorage.removeItem("pinz_session");
      localStorage.removeItem("pinz_session_v2");
      localStorage.removeItem("pinz_stok");
      localStorage.removeItem("pinz_users");
      localStorage.setItem("pinz_app_version", APP_VERSION);
      if (window.location.pathname !== "/login") {
        window.location.replace(import.meta.env.BASE_URL.replace(/\/$/, "") + "/login");
      }
    }
  }, []);
  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const isPublic = PUBLIC_PATHS.some((p) => location === p || location.startsWith(p + "/"));

  useEffect(() => {
    if (!user && !isPublic) navigate("/login");
  }, [user, location, isPublic, navigate]);

  if (!user && !isPublic) return null;
  return <>{children}</>;
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{ minHeight: "100vh" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function ImpersonateBar() {
  const { isImpersonating, endImpersonation, user } = useAuth();
  if (!isImpersonating || !user) return null;
  return (
    <div className="sticky top-0 z-[80] bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg">
      <div className="container mx-auto px-4 h-9 flex items-center justify-between text-xs sm:text-sm font-semibold">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span className="hidden sm:inline">Impersonasi aktif sebagai</span>
          <span className="sm:hidden">Impersonate</span>
          <span className="opacity-90">@{user.username}</span>
        </div>
        <button
          onClick={endImpersonation}
          className="inline-flex items-center gap-1.5 bg-black/40 hover:bg-black/60 px-3 py-1 rounded-full transition"
        >
          <X className="w-3.5 h-3.5" /> Kembali
        </button>
      </div>
    </div>
  );
}

function Router() {
  return (
    <AuthGuard>
      <PageTransition>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/" component={Home} />
          <Route path="/product/:id" component={ProductDetail} />
          <Route path="/history" component={History} />
          <Route path="/contact" component={Contact} />
          <Route path="/faq" component={FAQ} />
          <Route path="/developer" component={Developer} />
          <Route path="/payment/qris/:id" component={PaymentQRIS} />
          <Route path="/payment/usdt/:id" component={PaymentUSDT} />
          <Route path="/admin" component={Admin} />
          <Route path="/profile" component={Profile} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/garansi" component={Garansi} />
          <Route path="/replace-key" component={ReplaceKeyPage} />
          <Route path="/backup-email" component={BackupEmail} />
          <Route path="/pin" component={Pin} />
          <Route path="/wishlist" component={Wishlist} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/referral" component={ReferralPage} />
          <Route path="/chat" component={ChatPage} />
          <Route component={NotFound} />
        </Switch>
      </PageTransition>
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={150}>
          <ForceRelogin />
          <AuroraBackground />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <MaintenanceGate>
              <ImpersonateBar />
              <AdminModeBar />
              <ScheduledAnnouncementBanner />
              <Router />
            </MaintenanceGate>
          </WouterRouter>
          <Toaster />
          <BroadcastNotification />
          <UpdateBanner />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <LivePurchaseToast />
          </WouterRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
