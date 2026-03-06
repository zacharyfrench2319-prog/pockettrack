import { lazy, Suspense, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppLayout from "./components/AppLayout";
import { DashboardSkeleton } from "@/components/Skeletons";

// Lazy-loaded pages for better initial bundle size
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Home = lazy(() => import("./pages/Home"));
const Spending = lazy(() => import("./pages/Spending"));
const Goals = lazy(() => import("./pages/Goals"));
const Profile = lazy(() => import("./pages/Profile"));
const Scan = lazy(() => import("./pages/Scan"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min — show cached data, refetch silently
      gcTime: 10 * 60 * 1000,   // 10 min — keep unused cache
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="px-6 sm:px-8 pt-safe-top pb-4">
    <DashboardSkeleton />
  </div>
);

const App = () => {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.setBackgroundColor({ color: "#0F0F12" });
      });
      import("@capacitor/keyboard").then(({ Keyboard, KeyboardResize }) => {
        Keyboard.setResizeMode({ mode: KeyboardResize.Body });
        Keyboard.setScroll({ isDisabled: false });
      });
      import("@capacitor/splash-screen").then(({ SplashScreen }) => {
        SplashScreen.hide();
      });
    }
  }, []);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SubscriptionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route element={<AppLayout />}>
                  <Route path="/home" element={<Home />} />
                  <Route path="/spending" element={<Spending />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/scan" element={<Scan />} />
                </Route>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SubscriptionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
