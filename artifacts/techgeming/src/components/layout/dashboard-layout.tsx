import React from "react";
import { SidebarNav, MobileBottomNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  hideSearch?: boolean;
}

export function DashboardLayout({
  children,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  hideSearch,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex">
      <SidebarNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          searchValue={hideSearch ? undefined : searchValue}
          onSearchChange={hideSearch ? undefined : onSearchChange}
          searchPlaceholder={searchPlaceholder}
        />
        <main className="flex-1 px-4 sm:px-6 py-5 pb-24 lg:pb-10 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
