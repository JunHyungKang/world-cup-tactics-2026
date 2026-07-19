import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workflowPath = new URL("../.github/workflows/deploy-pages.yml", import.meta.url);

describe("GitHub Pages release workflow", () => {
  it("deploys only by an explicit manual run", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+push:/m);
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
  });

  it("builds and audits the same dist directory that it uploads", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("pnpm deployment:audit");
    expect(workflow).toContain("actions/upload-pages-artifact@v4");
    expect(workflow).toContain("path: ./dist");
  });

  it("grants only the permissions needed by GitHub Pages", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pages: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).toContain("actions/deploy-pages@v4");
  });
});
