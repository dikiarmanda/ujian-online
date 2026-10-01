export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRuntimeEnv } = await import("./server/env");
    assertRuntimeEnv();
  }
}
