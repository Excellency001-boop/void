"use client";

import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { DEFAULT_NETWORK, NETWORKS, networkById, type NetworkConfig } from "./networks";
import { createApiClient, type ApiClient } from "./api";

const STORAGE_KEY = "void-active-network";

interface NetworkContextValue {
  network: NetworkConfig;
  setNetworkId: (id: string) => void;
  api: ApiClient;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkId, setNetworkIdState] = useState(DEFAULT_NETWORK.id);

  // Remembered per-browser only, purely a convenience — never authoritative, and reads are
  // wrapped since localStorage can throw (private browsing, blocked site data) or just be absent.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && NETWORKS.some((n) => n.id === stored)) setNetworkIdState(stored);
    } catch {
      // ignore — default network stands
    }
  }, []);

  function setNetworkId(id: string) {
    setNetworkIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore — selection still works for this session via React state
    }
  }

  const network = networkById(networkId);
  const api = useMemo(() => createApiClient(network.apiUrl), [network.apiUrl]);

  return (
    <NetworkContext.Provider value={{ network, setNetworkId, api }}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
