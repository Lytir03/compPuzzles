export type ShutdownReason =
  | "SIGTERM"
  | "SIGINT"
  | "unhandled-rejection"
  | "uncaught-exception"
  | "startup-failure";

/** Railway ON_FAILURE must see fatal/startup crashes as non-zero exits. */
export function exitCodeForShutdown(reason: ShutdownReason): 0 | 1 {
  return reason === "SIGTERM" || reason === "SIGINT" ? 0 : 1;
}

export function escalateShutdownExitCode(current: 0 | 1, requested: 0 | 1): 0 | 1 {
  return current === 1 || requested === 1 ? 1 : 0;
}
