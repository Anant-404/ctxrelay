import { describe, expect, it } from "vitest";
import { extractExports, extractImports, jsTsExtractor } from "../src/extractors/js-ts.js";
import { expressExtractor } from "../src/extractors/express.js";
import { nextjsExtractor } from "../src/extractors/nextjs.js";
import { reactExtractor } from "../src/extractors/react.js";
import { prismaExtractor } from "../src/extractors/prisma.js";
import { sqlExtractor, extractTables } from "../src/extractors/sql.js";
import { mongooseExtractor } from "../src/extractors/mongoose.js";
import type { ExtractCtx, FileMeta } from "../src/extractors/types.js";

function ctx(path: string, source: string, stack: string[] = []): ExtractCtx {
  const ext = path.split(".").pop()!;
  const file: FileMeta = { path, ext, lang: ext };
  return { file, source, stack, root: "/repo" };
}

describe("js-ts", () => {
  it("extracts named, default, and brace exports", () => {
    const src = `
      export function createCheckout() {}
      export const handleWebhook = () => {};
      export class Foo {}
      export default function Page() {}
      export { a, b as c };
    `;
    const names = extractExports(src).map((e) => e.name);
    expect(names).toContain("createCheckout");
    expect(names).toContain("handleWebhook");
    expect(names).toContain("Foo");
    expect(names).toContain("Page");
    expect(names).toContain("a");
    expect(names).toContain("c");
  });

  it("extracts CommonJS exports (module.exports, exports.x, object)", () => {
    expect(extractExports("class Foo {}\nmodule.exports = Foo;").map((e) => e.name)).toContain(
      "Foo"
    );
    expect(
      extractExports("module.exports = { a, b, c };").map((e) => e.name).sort()
    ).toEqual(["a", "b", "c"]);
    const named = extractExports("exports.hello = () => {};\nmodule.exports.bye = 1;").map(
      (e) => e.name
    );
    expect(named).toContain("hello");
    expect(named).toContain("bye");
    // module.exports = function Name(){}
    expect(extractExports("module.exports = function Manager(){}").map((e) => e.name)).toContain(
      "Manager"
    );
  });

  it("collects and normalizes imports, dropping node builtins", () => {
    const src = `import fs from "node:fs"; import Stripe from "stripe"; const x = require("./local");`;
    const imports = extractImports(src);
    expect(imports).toContain("stripe");
    expect(imports).toContain("./local");
    expect(imports).not.toContain("fs");
    expect(imports).not.toContain("node:fs");
  });

  it("appliesTo js/ts extensions only", () => {
    expect(jsTsExtractor.appliesTo({ path: "a.ts", ext: "ts", lang: "ts" }, [])).toBe(true);
    expect(jsTsExtractor.appliesTo({ path: "a.sql", ext: "sql", lang: "sql" }, [])).toBe(false);
  });
});

describe("nextjs routes", () => {
  it("detects app-router verb exports", () => {
    const c = ctx(
      "app/api/checkout/route.ts",
      `export async function POST(){} export function GET(){}`,
      ["nextjs"]
    );
    const routes = nextjsExtractor.extract(c).routes!;
    const methods = routes.map((r) => r.method).sort();
    expect(methods).toEqual(["GET", "POST"]);
    expect(routes[0].path).toBe("/api/checkout");
  });

  it("maps page.tsx to a GET route with dynamic params", () => {
    const c = ctx("app/users/[id]/page.tsx", `export default function P(){return null}`, [
      "nextjs",
    ]);
    const routes = nextjsExtractor.extract(c).routes!;
    expect(routes[0].path).toBe("/users/:id");
  });
});

describe("express routes", () => {
  it("extracts verbs and applies a single static router mount prefix", () => {
    const src = `
      const app = express();
      const router = express.Router();
      app.get("/health", h);
      router.post("/orders", h);
      app.use("/api", router);
    `;
    const routes = expressExtractor.extract(ctx("src/server.ts", src, ["express"])).routes!;
    const paths = routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(paths).toContain("GET /health");
    expect(paths).toContain("POST /api/orders");
  });
});

describe("react components", () => {
  it("extracts props, hooks, and client flag", () => {
    const src = `"use client";
      import { useState } from "react";
      export function CheckoutForm({ cartId }: { cartId: string }) {
        const [x] = useState(0);
        return <button>{cartId}</button>;
      }`;
    const comps = reactExtractor.extract(ctx("C.tsx", src, ["react"])).components!;
    expect(comps[0].name).toBe("CheckoutForm");
    expect(comps[0].props).toContain("cartId");
    expect(comps[0].client).toBe(true);
    expect(comps[0].hooks).toContain("useState");
  });
});

describe("prisma", () => {
  it("parses models and fields", () => {
    const src = `model Order {
      id String @id
      userId String
      total Float
    }`;
    const models = prismaExtractor.extract(ctx("schema.prisma", src)).prisma!;
    expect(models[0].model).toBe("Order");
    expect(models[0].fields).toEqual(["id", "userId", "total"]);
  });
});

describe("sql", () => {
  it("parses CREATE TABLE columns, ignoring constraints", () => {
    const src = `CREATE TABLE users (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      PRIMARY KEY (id)
    );`;
    const tables = extractTables(src, "m.sql");
    expect(tables[0].table).toBe("users");
    expect(tables[0].columns).toEqual(["id", "email"]);
  });

  it("appliesTo sql only", () => {
    expect(sqlExtractor.appliesTo({ path: "a.sql", ext: "sql", lang: "sql" }, [])).toBe(true);
  });
});

describe("mongoose", () => {
  it("extracts collection name and top-level fields", () => {
    const src = `
      const SessionSchema = new mongoose.Schema({
        token: { type: String },
        userId: String,
        expiresAt: Date,
      });
      export const Session = mongoose.model("Session", SessionSchema);
    `;
    const cols = mongooseExtractor.extract(ctx("S.ts", src, ["mongoose"])).mongo!;
    expect(cols[0].collection).toBe("Session");
    expect(cols[0].fields).toEqual(["token", "userId", "expiresAt"]);
  });
});
