import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { backendSeedDemoAccounts } from "../backendStore";
import { getCurrentUser, setCurrentUser } from "../store";
import type { Tab, User } from "../types";

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedConversation: string | null;
  setSelectedConversation: (username: string | null) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);

  useEffect(() => {
    const user = getCurrentUser();
    setUser(user);

    // Seed demo accounts on the canister (async, fire-and-forget)
    backendSeedDemoAccounts().catch(() => {
      // Silently ignore — app works fine without canister demo accounts
    });
  }, []);

  const handleSetCurrentUser = useCallback((user: User | null) => {
    setCurrentUser(user);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setUser(null);
    setActiveTab("chats");
    setSelectedConversation(null);
  }, []);

  const refreshUser = useCallback(() => {
    const user = getCurrentUser();
    setUser(user ? { ...user } : null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser: handleSetCurrentUser,
        activeTab,
        setActiveTab,
        selectedConversation,
        setSelectedConversation,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
