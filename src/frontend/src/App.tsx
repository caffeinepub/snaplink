import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { BottomNav } from "./components/BottomNav";
import { CameraTab } from "./components/CameraTab";
import { ChatsTab } from "./components/ChatsTab";
import { LoginScreen } from "./components/LoginScreen";
import { ProfileTab } from "./components/ProfileTab";
import { RequestsTab } from "./components/RequestsTab";
import { AppProvider, useApp } from "./context/AppContext";

function AppShell() {
  const { currentUser, activeTab } = useApp();

  if (!currentUser) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full min-h-screen"
        >
          <LoginScreen />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "chats" && (
            <motion.div
              key="chats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <ChatsTab />
            </motion.div>
          )}
          {activeTab === "requests" && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
              className="absolute inset-0"
            >
              <RequestsTab />
            </motion.div>
          )}
          {activeTab === "camera" && (
            <motion.div
              key="camera"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
              className="absolute inset-0"
            >
              <CameraTab />
            </motion.div>
          )}
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
              className="absolute inset-0"
            >
              <ProfileTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen" style={{ background: "#1A1A2E" }}>
        {/* Mobile-first container */}
        <div
          className="mx-auto h-dvh overflow-hidden relative"
          style={{ maxWidth: 430 }}
        >
          <AppShell />
        </div>
        {/* Desktop sidebar fill */}
        <style>{`
          @media (min-width: 431px) {
            body::before {
              content: '';
              position: fixed;
              inset: 0;
              background: radial-gradient(ellipse at center, #1a1f33 0%, #1A1A2E 70%);
              z-index: -1;
            }
          }
        `}</style>
      </div>
      <Toaster position="top-center" theme="dark" />
    </AppProvider>
  );
}
