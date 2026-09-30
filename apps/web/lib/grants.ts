import path from "node:path";
import type { Grant } from "@pipeline/authorization";
import { GrantStore } from "@pipeline/grants";
import { repoRoot } from "./dataset";

export function grantsPath(): string {
  return path.join(repoRoot(), "data", "grants.json");
}

export function auditPath(): string {
  return path.join(repoRoot(), "data", "audit.log");
}

export async function loadGrantStore(): Promise<GrantStore> {
  return GrantStore.load(grantsPath());
}

export async function authorizationGrants(): Promise<Grant[]> {
  return (await loadGrantStore()).toAuthorizationGrants();
}
