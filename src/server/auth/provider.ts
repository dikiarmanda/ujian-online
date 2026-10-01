import { env } from "../env";
import { mockAuthProvider } from "./mock";
import { remoteAuthProvider } from "./remote";
import type { AuthProvider } from "./types";

export function authProvider(): AuthProvider {
  return env().authDriver === "remote" ? remoteAuthProvider : mockAuthProvider;
}
