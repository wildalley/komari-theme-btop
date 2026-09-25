import React, { useState, useEffect, useRef } from "react";
import { NodeState, ThemeMode, WSEvent } from "./types";
import { BtopTerminalView } from "./components/BtopTerminalView";

/** komari-theme.json `configuration.data` 里可由后台配置的键。 */
interface ManagedThemeConfig {
  defaultColorMode?: "dark" | "light";
  refreshInterval?: number;
}

const REFRESH_KEY = "cyber_probe_color_mode";

export function App() {
  const [colorMode, setColorMode] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem(REFRESH_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });

  const theme: ThemeMode = colorMode === "dark" ? "btop" : "btop-light";
  const isLight = colorMode === "light";

  useEffect(() => {
    document.documentElement.classList.remove("dark", "blueprint", "blueprint-dark", "btop", "btop-light");
    if (isLight) {
      document.documentElement.classList.add("btop-light");
      document.documentElement.setAttribute("data-theme", "btop-light");
    } else {
      document.documentElement.classList.add("dark", "btop");
      document.documentElement.setAttribute("data-theme", "btop");
    }
  }, [colorMode, isLight]);

  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [config, setConfig] = useState<ManagedThemeConfig>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Check auth. Probe serves /api/v1/auth/status; Komari serves /api/me.
  useEffect(() => {
    let cancelled = false;
    const checkProbe = async () => {
      try {
        const r = await fetch("/api/v1/auth/status", { credentials: "include" });
        if (!r.ok) return false;
        const data = await r.json();
        if (!cancelled && data.authenticated) {
          setCanManage(true);
          setUsername(data.username || "admin");
          return true;
        }
        return false;
      } catch (_) {
        return false;
      }
    };
    const checkKomari = async () => {
      try {
        const r = await fetch("/api/me");
        if (!r.ok) return;
        const me = await r.json();
        if (!cancelled && me.logged_in) {
          setCanManage(true);
          setUsername(me.username || "admin");
        }
      } catch (_) {}
    };
    (async () => {
      if (!(await checkProbe())) await checkKomari();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the managed theme configuration. `/api/public` is served by both
  // Komari and Cyber Probe (data.theme_settings); a failure just keeps the
  // built-in defaults. An explicit user choice always wins over the default.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        const data = payload?.data ?? payload ?? {};
        const settings = (data.theme_settings ?? data.themeSettings ?? {}) as Record<string, unknown>;
        const parsed: ManagedThemeConfig = {};
        if (settings.defaultColorMode === "dark" || settings.defaultColorMode === "light") {
          parsed.defaultColorMode = settings.defaultColorMode;
        }
        const interval = Number(settings.refreshInterval);
        if (Number.isFinite(interval) && interval > 0) {
          parsed.refreshInterval = Math.min(Math.max(interval, 1), 10);
        }
        setConfig(parsed);
        if (!localStorage.getItem(REFRESH_KEY) && parsed.defaultColorMode) {
          setColorMode(parsed.defaultColorMode);
        }      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch nodes and setup telemetry transport
  useEffect(() => {
    let unmounted = false;
    let pollTimer: any = null;
    let reconnectTimer: any = null;
    let reconnectAttempts = 0;

    const fetchNodes = async () => {
      // 1. Try Probe native API
      try {
        const res = await fetch("/api/v1/nodes", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && !unmounted) {
            setNodes(data);
            setupProbeWS();
            // Safety net: refresh over REST while the WebSocket is down, so a
            // failed or dropped connection degrades to 3s-fresh data instead
            // of a frozen dashboard.
            pollTimer = setInterval(async () => {
              if (unmounted || wsRef.current?.readyState === WebSocket.OPEN) return;
              try {
                const r = await fetch("/api/v1/nodes", { credentials: "include" });
                if (r.ok) {
                  const j = await r.json();
                  if (Array.isArray(j) && !unmounted) setNodes(j);
                }
              } catch (_) {}
            }, 3000);
            return;
          }
        }
      } catch (_) {}

      // 2. Fallback to Komari API
      try {
        const res = await fetch("/api/nodes");
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : json.data || [];
          if (!unmounted) {
            setNodes(mapKomariClients(list));
            setupKomariWS();
            // Also poll as backup
            pollTimer = setInterval(async () => {
              try {
                const r = await fetch("/api/nodes");
                if (r.ok) {
                  const j = await r.json();
                  const l = Array.isArray(j) ? j : j.data || [];
                  if (!unmounted) setNodes(mapKomariClients(l));
                }
              } catch (_) {}
            }, 3000);
          }
        }
      } catch (err) {
        console.error("Failed to load node data:", err);
      }
    };

    const applyWsEvent = (wsEvent: WSEvent) => {
      if (wsEvent.type === "nodes_snapshot" && Array.isArray(wsEvent.data)) {
        setNodes(wsEvent.data);
      } else if (wsEvent.type === "node_update" && wsEvent.data) {
        const node: NodeState = wsEvent.data;
        setNodes((prev) => {
          const idx = prev.findIndex((n) => n.node_id === node.node_id);
          if (idx >= 0) {
            const clone = [...prev];
            clone[idx] = { ...clone[idx], ...node };
            return clone;
          }
          return [...prev, node];
        });
      } else if (wsEvent.type === "node_offline" && wsEvent.data) {
        const node: NodeState = wsEvent.data;
        setNodes((prev) =>
          prev.map((n) => (n.node_id === node.node_id ? { ...n, is_online: false, rate_down: 0, rate_up: 0 } : n))
        );
      } else if (wsEvent.type === "node_delete" && wsEvent.data?.node_id) {
        setNodes((prev) => prev.filter((n) => n.node_id !== wsEvent.data.node_id));
      }
    };

    const scheduleReconnect = (setup: () => void) => {
      if (unmounted) return;
      reconnectAttempts += 1;
      const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts - 1));
      reconnectTimer = setTimeout(() => {
        if (!unmounted) setup();
      }, delay);
    };

    const setupProbeWS = () => {
      try {
        wsRef.current?.close();
      } catch (_) {}
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/api/v1/client/ws`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const wsEvent: WSEvent = JSON.parse(e.data);
          applyWsEvent(wsEvent);
        } catch (_) {}
      };
      ws.onopen = () => {
        reconnectAttempts = 0;
      };
      ws.onclose = () => {
        if (!unmounted) scheduleReconnect(setupProbeWS);
      };
    };

    const setupKomariWS = () => {
      try {
        wsRef.current?.close();
      } catch (_) {}
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/api/clients`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          // Komari live stream updates
          if (data && typeof data === "object") {
            setNodes((prev) =>
              prev.map((n) => {
                const update = data[n.node_id];
                if (!update) return n;
                const cpuUsage = update.cpu?.usage ?? n.cpu;
                const memUsed = update.ram?.used ?? n.system.mem_used;
                const memTotal = update.ram?.total ?? n.system.mem_total;
                const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : n.mem;
                const rateDown = update.network?.rx_speed ?? n.rate_down;
                const rateUp = update.network?.tx_speed ?? n.rate_up;
                return {
                  ...n,
                  is_online: true,
                  cpu: cpuUsage,
                  mem: memPct,
                  rate_down: rateDown,
                  rate_up: rateUp,
                  system: {
                    ...n.system,
                    cpu_percent: cpuUsage,
                    mem_used: memUsed,
                    mem_total: memTotal,
                    uptime: update.uptime ?? n.system.uptime,
                  },
                };
              })
            );
          }
        } catch (_) {}
      };
      ws.onopen = () => {
        reconnectAttempts = 0;
      };
      ws.onclose = () => {
        if (!unmounted) scheduleReconnect(setupKomariWS);
      };
    };

    fetchNodes();

    return () => {
      unmounted = true;
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        try {
          ws.close();
        } catch (_) {}
      }
    };
  }, []);

  const toggleTheme = () => {
    setColorMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(REFRESH_KEY, next);
      return next;
    });
  };

  const handleSelectTheme = (t: ThemeMode) => {
    const next = t === "btop-light" ? "light" : "dark";
    localStorage.setItem(REFRESH_KEY, next);
    setColorMode(next);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
      await fetch("/api/logout");
    } catch (_) {}
    window.location.reload();
  };

  return (
    <div className={`min-h-screen ${isLight ? "bg-[#ebe7ee] text-[#2b2735]" : "bg-[#0c0e17] text-[#e2e8f0]"}`}>
      <BtopTerminalView
        nodes={nodes}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelectTheme={handleSelectTheme}
        onOpenAdminModal={() => {
          window.location.href = "/admin";
        }}
        canManage={canManage}
        username={username}
        onLogout={handleLogout}
        refreshIntervalMs={(config.refreshInterval ?? 2) * 1000}
      />
    </div>
  );
}

// Helper to adapt standard Komari nodes to NodeState. Fields Komari does not
// report stay zero/empty — the view shows "--" — rather than invented values
// that look real.
function mapKomariClients(list: any[]): NodeState[] {
  return list.map((c: any) => {
    const isOnline = c.status === 1 || c.status === "online";
    return {
      node_id: c.uuid || c.id || "node",
      name: c.name || "Server",
      region: c.region || "",
      tags: c.tags ? (typeof c.tags === "string" ? c.tags.split(",") : c.tags) : [],
      is_online: isOnline,
      last_seen: Date.now() / 1000,
      cpu: 0,
      mem: 0,
      disk: 0,
      rate_down: 0,
      rate_up: 0,
      uptime_str: "",
      system: {
        os: c.system?.os || "",
        kernel: c.system?.kernel_version || "",
        cpu_model: c.system?.cpu_name || "",
        cpu_count: c.system?.cpu_cores || 0,
        cpu_percent: 0,
        mem_used: 0,
        mem_total: c.system?.memory_total || 0,
        disk_used: 0,
        disk_total: c.system?.disk_total || 0,
        disk_percent: 0,
        uptime: 0,
      },
      network: {
        bytes_sent: 0,
        bytes_recv: 0,
        tcp_established: 0,
        rate_upload: 0,
        rate_download: 0,
      },
    };
  });
}
