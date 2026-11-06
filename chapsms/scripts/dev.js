// Starts the backend API and the Next.js frontend together: `npm run dev`.
// Ctrl+C stops both. Use `npm run dev:web` for the frontend alone.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const backendDir = path.join(root, "backend");
const webDir = path.resolve(__dirname, "..");
const webPort = process.env.WEB_PORT || "3100";

// Optional local DNS workaround, if present.
const dnsFix = path.join(root, ".claude", "dns-fix.js");
const nodeOptions = [
  process.env.NODE_OPTIONS,
  fs.existsSync(dnsFix) ? `--require=${dnsFix}` : "",
]
  .filter(Boolean)
  .join(" ");

const procs = [
  {
    name: "api",
    color: "\x1b[36m",
    cwd: backendDir,
    args: ["run", "dev"],
    env: {
      // Never run the order check locally alongside the live server.
      ORDER_RECONCILER_ENABLED: "false",
      NODE_OPTIONS: nodeOptions,
    },
  },
  {
    name: "web",
    color: "\x1b[35m",
    cwd: webDir,
    args: ["run", "dev:web", "--", "--port", webPort],
    env: {},
  },
];

const children = [];
let stopping = false;

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(c.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      c.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 500);
}

for (const p of procs) {
  const child = spawn("npm", p.args, {
    cwd: p.cwd,
    env: { ...process.env, ...p.env },
    shell: process.platform === "win32",
  });
  children.push(child);

  const tag = `${p.color}[${p.name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on("data", (d) =>
      out.write(
        String(d)
          .split(/\r?\n/)
          .filter((l, i, a) => l || i < a.length - 1)
          .map((l) => tag + l)
          .join("\n") + "\n"
      )
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${tag}exited with code ${code}; stopping the other process`);
      stopAll(code || 1);
    }
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
