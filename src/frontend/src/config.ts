import {
  createActor,
  type backendInterface,
  type CreateActorOptions,
} from "./backend";
import { HttpAgent } from "@icp-sdk/core/agent";

interface JsonConfig {
  backend_host: string;
  backend_canister_id: string;
  project_id: string;
  ii_derivation_origin: string;
}

interface Config {
  backend_host?: string;
  backend_canister_id: string;
  project_id: string;
  ii_derivation_origin?: string;
}

let configCache: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (configCache) return configCache;

  const backendCanisterId = process.env.CANISTER_ID_BACKEND;
  const envBaseUrl = process.env.BASE_URL || "/";
  const baseUrl = envBaseUrl.endsWith("/") ? envBaseUrl : `${envBaseUrl}/`;

  try {
    const response = await fetch(`${baseUrl}env.json`);
    const config = (await response.json()) as JsonConfig;

    if (!backendCanisterId && config.backend_canister_id === "undefined") {
      throw new Error("CANISTER_ID_BACKEND is not set");
    }

    configCache = {
      backend_host:
        config.backend_host === "undefined" ? undefined : config.backend_host,
      backend_canister_id: (
        config.backend_canister_id === "undefined"
          ? backendCanisterId
          : config.backend_canister_id
      ) as string,
      project_id:
        config.project_id !== "undefined" ? config.project_id : "0000000-0000-0000-0000-00000000000",
      ii_derivation_origin:
        config.ii_derivation_origin === "undefined"
          ? undefined
          : config.ii_derivation_origin,
    };
    return configCache;
  } catch {
    if (!backendCanisterId) throw new Error("CANISTER_ID_BACKEND is not set");
    return {
      backend_host: undefined,
      backend_canister_id: backendCanisterId,
      project_id: "0000000-0000-0000-0000-00000000000",
      ii_derivation_origin: undefined,
    };
  }
}

function extractAgentErrorMessage(error: string): string {
  const match = String(error).match(/with message:\s*'([^']+)'/s);
  return match ? match[1] : String(error);
}

function processError(e: unknown): never {
  if (e && typeof e === "object" && "message" in e) {
    throw new Error(extractAgentErrorMessage(`${(e as any).message}`));
  }
  throw e;
}

async function maybeLoadMockBackend(): Promise<backendInterface | null> {
  if (import.meta.env.VITE_USE_MOCK !== "true") return null;
  try {
    const mockModules = import.meta.glob("./mocks/backend.{ts,tsx,js,jsx}");
    const path = Object.keys(mockModules)[0];
    if (!path) return null;
    const mod = (await mockModules[path]()) as { mockBackend?: backendInterface };
    return mod.mockBackend ?? null;
  } catch {
    return null;
  }
}

export async function createActorWithConfig(
  options?: CreateActorOptions,
): Promise<backendInterface> {
  const mock = await maybeLoadMockBackend();
  if (mock) return mock;

  const config = await loadConfig();
  const resolvedOptions = options ?? {};

  const agent = new HttpAgent({
    ...resolvedOptions.agentOptions,
    host: config.backend_host,
  });

  if (config.backend_host?.includes("localhost")) {
    await agent.fetchRootKey().catch((err) => {
      console.warn("Unable to fetch root key. Check that your local replica is running");
      console.error(err);
    });
  }

  return createActor(config.backend_canister_id, {
    ...resolvedOptions,
    agent,
    processError,
  });
}
