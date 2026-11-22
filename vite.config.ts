import { networkInterfaces } from "node:os";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_TARGET = process.env.AIC_API_TARGET ?? "http://127.0.0.1:8787";

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

/**
 * 개발 서버에서만 쓰는 도우미. 선생님이 127.0.0.1로 콘솔을 열면 학생 기기에서는
 * 그 주소가 열리지 않으므로, 이 PC의 와이파이 IP를 알려 줘 QR·링크를 바꿀 수 있게 한다.
 */
function lanHintPlugin() {
  return {
    name: "aic-lan-hint",
    configureServer(server: {
      middlewares: { use: (path: string, handler: (req: unknown, res: unknown) => void) => void };
      config: { server: { port?: number } };
    }) {
      server.middlewares.use("/dev/lan-hint", (_req, res) => {
        const response = res as {
          setHeader: (name: string, value: string) => void;
          end: (body: string) => void;
        };
        const port = server.config.server.port ?? 5173;
        response.setHeader("content-type", "application/json");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify({ port, ips: lanAddresses() }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), lanHintPlugin()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  // classroom mode: build → `vite preview` serves the real bundle to the whole class
  preview: {
    host: process.env.AIC_HOST ?? "0.0.0.0",
    port: Number(process.env.AIC_PREVIEW_PORT ?? 8000),
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: false,
        ws: true,
      },
    },
  },
  server: {
    port: Number(process.env.AIC_PORT ?? 5173),
    // Open to phones/tablets on the same LAN or tailnet.
    host: process.env.AIC_HOST ?? "0.0.0.0",
    // Tailscale Serve/MagicDNS hostnames reach the dev server through a proxy.
    allowedHosts: [".ts.net", ".local", ".lan"],
    proxy: {
      "/api": {
        target: API_TARGET,
        // Keep the browser-facing Host so the Worker's same-origin checks
        // also work when Vite is opened from a LAN/Tailscale IP or hostname.
        changeOrigin: false,
        ws: true,
      },
    },
  },
});
