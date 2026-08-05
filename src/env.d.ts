/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace Cloudflare {
  interface Env {
    ADMIN_PASSWORD: string;
    ADMIN_COOKIE_SECRET: string;
  }
}

declare namespace App {
  interface Locals extends Runtime {}
}
