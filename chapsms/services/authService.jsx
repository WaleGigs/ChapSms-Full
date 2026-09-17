"use client";

/*
 * Compatibility bridge.
 *
 * Some older ChapsSms files import:
 *   "@/services/authService"
 *
 * while newer auth pages import:
 *   "@/services/auth.service"
 *
 * Keep one implementation in auth.service.jsx and re-export it here so
 * both import styles resolve to exactly the same authentication service.
 */

export * from "./auth.service";

export {
  default,
} from "./auth.service";
