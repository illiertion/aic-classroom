import { readFileSync } from "node:fs";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

/**
 * HTTPS variant of the dev server. Browsers only expose getDisplayMedia,
 * navigator.clipboard and crypto.subtle to secure contexts, so students on a
 * phone/tablet must open https://<this-pc-ip>:8443 instead of http://…:8000.
 *
 * The certificate is self-signed: the browser shows a warning once, choose
 * “고급 → 계속” and everything works for the rest of the session.
 */
export default mergeConfig(
  base,
  defineConfig({
    server: {
      port: Number(process.env.AIC_HTTPS_PORT ?? 8443),
      https: {
        cert: readFileSync(".certs/aic-cert.pem"),
        key: readFileSync(".certs/aic-key.pem"),
      },
    },
  }),
);
