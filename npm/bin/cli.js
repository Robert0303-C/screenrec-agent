#!/usr/bin/env node
/* screenrec-agent —— npm 外壳
 *
 * 为什么有这一层：MCP 的目录（官方 Registry、Glama、PulseMCP）只接受"一条命令装得上"的包
 * （npx / uvx / 镜像）。我们是 Windows 的原生 exe，装不上，所以用它把 exe 拉下来再原地转发。
 *
 * 两条铁律：
 *   1. 绝不往 stdout 写东西。MCP 走 stdio，标准的 JSON-RPC 就写在 stdout 上，多一个字节就坏。
 *      —— 所有日志、进度一律走 stderr。
 *   2. 首次运行才下载，之后直接起。缓存放 %LOCALAPPDATA%\screenrec-agent\。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { URL } = require("url");

// 发布后把 OWNER/REPO 换成真实仓库；本地测试可用 SCREENREC_BASE_URL 指到任意 http 目录
const OWNER = process.env.SCREENREC_OWNER || "Robert0303-C";
const REPO = process.env.SCREENREC_REPO || "screenrec-agent";
const VERSION = process.env.SCREENREC_VERSION || "v0.1.0";

const BASE_URL =
  process.env.SCREENREC_BASE_URL ||
  `https://github.com/${OWNER}/${REPO}/releases/download/${VERSION}`;

const FILES = [
  { name: "screenrec-agent.exe", size: 34453710 },
  { name: "ffmpeg.exe", size: 211091968 },
];

function cacheDir() {
  if (process.env.SCREENREC_CACHE) return process.env.SCREENREC_CACHE;
  const base = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || ".", "AppData", "Local");
  return path.join(base, "screenrec-agent", "bin");
}

function log(msg) {
  process.stderr.write(`[screenrec-agent] ${msg}\n`);
}

function human(n) {
  return (n / 1048576).toFixed(0) + " MB";
}

function download(url, dest, expectSize, label) {
  return new Promise((resolve, reject) => {
    const go = (u, hops = 0) => {
      if (hops > 6) return reject(new Error("too many redirects"));
      const mod = u.startsWith("https:") ? https : http;
      mod
        .get(u, { headers: { "User-Agent": "screenrec-agent-npm" } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return go(new URL(res.headers.location, u).toString(), hops + 1);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`${label}: HTTP ${res.statusCode}`));
          }
          const tmp = dest + ".part";
          const out = fs.createWriteStream(tmp);
          let got = 0;
          let last = 0;
          res.on("data", (c) => {
            got += c.length;
            const pct = expectSize ? Math.floor((got / expectSize) * 100) : -1;
            if (pct >= 0 && pct >= last + 10) {
              last = pct - (pct % 10);
              log(`${label} ${pct}% (${human(got)})`);
            }
          });
          res.pipe(out);
          out.on("finish", () => {
            out.close(() => {
              if (expectSize && got < expectSize * 0.9) {
                try { fs.unlinkSync(tmp); } catch (_) {}
                return reject(new Error(`${label}: truncated (${got} of ${expectSize})`));
              }
              fs.renameSync(tmp, dest);
              resolve();
            });
          });
          out.on("error", reject);
        })
        .on("error", reject);
    };
    go(url);
  });
}

async function ensureBinary() {
  const dir = cacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const exe = path.join(dir, "screenrec-agent.exe");

  const missing = FILES.filter((f) => {
    const p = path.join(dir, f.name);
    return !fs.existsSync(p) || fs.statSync(p).size < f.size * 0.9;
  });

  if (missing.length === 0) return exe;

  log(`first run — downloading ${missing.map((m) => m.name).join(", ")} (~234 MB) into ${dir}`);
  for (const f of missing) {
    const url = `${BASE_URL}/${f.name}`;
    log(`fetching ${url}`);
    await download(url, path.join(dir, f.name), f.size, f.name);
  }
  return exe;
}

(async () => {
  let exe;
  try {
    exe = await ensureBinary();
  } catch (e) {
    log(`setup failed: ${e.message}`);
    log("re-run once the network is back; nothing else is needed.");
    process.exit(1);
  }

  // 原样转发参数与 stdio —— MCP 客户端看到的仍是一个本地 stdio 服务
  const child = spawn(exe, process.argv.slice(2), { stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code === null ? 1 : code);
  });
  ["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => child.kill(s)));
})();
