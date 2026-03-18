import type { Config } from "vike/types";
import vikeReact from "vike-react/config";

// Keep in sync with lib/app-config.ts (Vike config can't import runtime modules)
export default {
  title: "{{APP_DISPLAY_NAME}}",
  description: "A modern full-stack application",
  extends: [vikeReact],
} satisfies Config;
