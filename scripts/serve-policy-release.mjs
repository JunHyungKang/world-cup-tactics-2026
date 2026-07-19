import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const root = resolve(process.cwd(), argument("--root", "dist-policy-lab"));
const port = Number(argument("--port", "4175"));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("--port must be a valid TCP port");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const invalid = url.pathname === "/invalid" || url.pathname.startsWith("/invalid/");
    let pathname = invalid ? url.pathname.replace(/^\/invalid/u, "") : url.pathname;
    if (pathname === "" || pathname === "/") pathname = "/index.html";
    if (invalid && pathname === "/data/policy-lab-spike.json") {
      response.writeHead(200, { "content-type": mime[".json"], "cache-control": "no-store" });
      response.end('{"status":"PASS","policy_campaign":null}\n');
      return;
    }
    const candidate = resolve(root, `.${decodeURIComponent(pathname)}`);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) throw new Error("path traversal");
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error("not a file");
    const bytes = await readFile(candidate);
    response.writeHead(200, { "content-type": mime[extname(candidate)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(bytes);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Policy Lab release: http://127.0.0.1:${port}/`));
