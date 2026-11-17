export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRuntimeEnv } = await import("./server/env");
    assertRuntimeEnv();

    const { logError } = await import("./server/logger");
    process.on("unhandledRejection", (reason) => {
      logError("error_server", {
        msg: "Unhandled promise rejection",
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });
    process.on("uncaughtException", (error) => {
      logError("error_server", {
        msg: "Uncaught exception",
        error: error.message,
        stack: error.stack,
      });
    });
  }
}
