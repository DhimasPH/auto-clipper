import React from "react";
import { Outlet } from "react-router-dom";
import { BackendBanner } from "../components/nav/BackendBanner";
import { BottomNav } from "../components/nav/BottomNav";
import { ConnectionStatus } from "../components/nav/ConnectionStatus";
import { RunningBar } from "../components/nav/RunningBar";
import { SideNav } from "../components/nav/SideNav";
import { BackendStatusProvider } from "../hooks/useBackendStatus";

/** One responsive frame (spec 4.1): bottom bar under 768 px, slim side bar above. */
export const AppLayout: React.FC = () => (
  <BackendStatusProvider>
    <div className="min-h-dvh bg-bg-primary text-text-primary md:flex">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg-primary px-4 md:px-8">
          <span className="text-card-title text-text-primary lg:invisible">Auto Clipper</span>
          <ConnectionStatus />
        </header>
        <BackendBanner />
        <RunningBar />
        <main className="w-full flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  </BackendStatusProvider>
);
