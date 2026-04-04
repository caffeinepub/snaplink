import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  backendLogin,
  backendLoginWithII,
  backendRegister,
  backendRegisterWithII,
} from "../backendStore";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  loginOrRegisterII,
  mergeWithCache,
  setCurrentUser as persistUser,
} from "../store";
import { AnimatedLogo } from "./Logo";
import { PressableButton } from "./Shared";

export function LoginScreen() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useApp();
  const { login: iiLogin, identity, isLoggingIn } = useInternetIdentity();

  // Use a ref so this flag persists across re-renders without resetting
  const iiHandledRef = useRef(false);

  const handleIILogin = () => {
    setError("");
    iiLogin();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        const result = await backendLogin(username, password);
        if ("err" in result) {
          setError(result.err);
        } else {
          const user = mergeWithCache(result.ok);
          persistUser(user);
          setCurrentUser(user);
        }
      } else {
        if (!displayName.trim()) {
          setError("Display name is required");
          return;
        }
        const result = await backendRegister(username, password, displayName);
        if ("err" in result) {
          setError(result.err);
        } else {
          const user = mergeWithCache(result.ok);
          persistUser(user);
          setCurrentUser(user);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle II identity becoming available after login
  useEffect(() => {
    if (
      identity &&
      !identity.getPrincipal().isAnonymous() &&
      !iiHandledRef.current
    ) {
      iiHandledRef.current = true;
      const principal = identity.getPrincipal().toString();

      const handleII = async () => {
        // Try login first
        const loginResult = await backendLoginWithII(identity);
        if ("ok" in loginResult) {
          const user = mergeWithCache(loginResult.ok);
          persistUser(user);
          setCurrentUser(user);
          return;
        }
        // No account yet — register automatically
        const autoUsername = `ii_${principal.slice(0, 8)}`;
        const autoDisplayName = `User ${principal.slice(0, 6)}`;
        const registerResult = await backendRegisterWithII(
          identity,
          autoUsername,
          autoDisplayName,
        );
        if ("ok" in registerResult) {
          const user = mergeWithCache(registerResult.ok);
          persistUser(user);
          setCurrentUser(user);
        } else {
          // Username might already be taken — try with a longer suffix
          const fallbackUsername = `ii_${principal.slice(0, 12)}`;
          const fallbackResult = await backendRegisterWithII(
            identity,
            fallbackUsername,
            autoDisplayName,
          );
          if ("ok" in fallbackResult) {
            const user = mergeWithCache(fallbackResult.ok);
            persistUser(user);
            setCurrentUser(user);
          }
        }
      };

      handleII().catch(() => {
        // If canister is unreachable, fall back to localStorage
        const user = loginOrRegisterII(principal);
        persistUser(user);
        setCurrentUser(user);
      });
    }
  }, [identity, setCurrentUser]);

  const nameId = "auth-display-name";
  const usernameId = "auth-username";
  const passwordId = "auth-password";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-8"
      style={{ background: "#1A1A2E" }}
    >
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4 mb-8"
      >
        <AnimatedLogo size={90} />
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gradient tracking-tight">
            SnapLink
          </h1>
          <p className="text-[#B0B0CC] text-sm mt-1">
            Connect. Snap. Disappear.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Tabs */}
        <div
          className="flex rounded-2xl p-1 mb-6"
          style={{ background: "#1A1F33", border: "1px solid #2A3048" }}
          data-ocid="auth.tab"
        >
          {(["login", "register"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className="flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200"
              style={{
                background:
                  tab === t
                    ? "linear-gradient(135deg, #00CFFF, #0077AA)"
                    : "transparent",
                color: tab === t ? "white" : "#B0B0CC",
              }}
            >
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={tab}
            initial={{ opacity: 0, x: tab === "login" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "login" ? 20 : -20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {tab === "register" && (
              <div>
                <label
                  htmlFor={nameId}
                  className="block text-[#B0B0CC] text-xs font-medium mb-1.5 ml-1"
                >
                  Display Name
                </label>
                <input
                  id={nameId}
                  className="input-field"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  data-ocid="auth.input"
                />
              </div>
            )}
            <div>
              <label
                htmlFor={usernameId}
                className="block text-[#B0B0CC] text-xs font-medium mb-1.5 ml-1"
              >
                Username
              </label>
              <input
                id={usernameId}
                className="input-field"
                type="text"
                placeholder="@username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-ocid="auth.input"
              />
            </div>
            <div>
              <label
                htmlFor={passwordId}
                className="block text-[#B0B0CC] text-xs font-medium mb-1.5 ml-1"
              >
                Password
              </label>
              <input
                id={passwordId}
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-ocid="auth.input"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(239,68,68,0.15)",
                  color: "#FF6B6B",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
                data-ocid="auth.error_state"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl font-bold text-base text-white btn-glow-blue"
              data-ocid="auth.submit_button"
            >
              {loading
                ? "Loading..."
                : tab === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </motion.form>
        </AnimatePresence>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: "#2A3048" }} />
          <span className="text-[#B0B0CC] text-xs">or</span>
          <div className="flex-1 h-px" style={{ background: "#2A3048" }} />
        </div>

        <PressableButton
          className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-3"
          style={{
            background: "#1A1F33",
            border: "1.5px solid #2A3048",
            color: "#FFFFFF",
          }}
          onClick={handleIILogin}
          disabled={isLoggingIn}
          data-ocid="auth.primary_button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" fill="url(#iiGrad)" />
            <path
              d="M8 12h8M12 8v8"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="iiGrad" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stopColor="#00CFFF" />
                <stop offset="100%" stopColor="#BD00FF" />
              </linearGradient>
            </defs>
          </svg>
          {isLoggingIn ? "Connecting..." : "Continue with Internet Identity"}
        </PressableButton>

        <p className="text-center text-[#B0B0CC]/50 text-xs mt-6">
          Demo: username <span className="text-[#00CFFF]/70">alex_nova</span>,
          password <span className="text-[#00CFFF]/70">demo123</span>
        </p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-8 text-center"
        style={{
          color: "#B0B0CC",
          opacity: 0.5,
          fontSize: "12px",
          fontStyle: "italic",
          letterSpacing: "0.05em",
        }}
      >
        Made by Deepak Chahal
      </motion.p>
    </div>
  );
}
