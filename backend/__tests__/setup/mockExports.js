import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { jest } from "@jest/globals";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * A jest.fn() for every named export of a backend module, plus overrides.
 *
 * Hand-written `unstable_mockModule` factories break with a SyntaxError
 * whenever the real module gains an export its importers use; deriving the
 * names from the source keeps the mock in step.
 *
 *   jest.unstable_mockModule("../app/services/x.js", () =>
 *     mockExportsOf("app/services/x.js", { foo: mockFoo }));
 */
export function mockExportsOf(relativePath, overrides = {}) {
  const source = readFileSync(path.join(backendRoot, relativePath), "utf8");
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name && name !== "default") names.add(name);
    }
  }
  const mocked = Object.fromEntries([...names].map((name) => [name, jest.fn()]));
  if (/export\s+default\b/.test(source)) mocked.default = { ...mocked };
  return { ...mocked, ...overrides };
}
