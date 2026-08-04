import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import AppErrorBoundary from "../ErrorBoundary";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-in" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10 h-full w-64 animate-zoom-in-95 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AppErrorBoundary>{children}</AppErrorBoundary>
        </main>
      </div>
    </div>
  );
}
