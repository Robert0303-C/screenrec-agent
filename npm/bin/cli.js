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
// 这是【exe 所在的 release tag】，不是 npm 包版本。外壳 0.1.2 复用同一个 exe，
// 用户升级外壳时缓存目录不变，不会重新下载 234 MB。
const VERSION = process.env.SCREENREC_VERSION || "v0.1.4";

const BASE_URL =
  process.env.SCREENREC_BASE_URL ||
  `https://github.com/${OWNER}/${REPO}/releases/download/${VERSION}`;

// ffmpeg 是钉死的依赖，不随版本变 —— 固定从 v0.1.0 那个 release 取，
// 免得每次发版都重传 201 MB
const FFMPEG_TAG = process.env.SCREENREC_FFMPEG_TAG || "v0.1.0";

/* sha256 取自 GitHub Release 资产的官方 digest（API 的 assets[].digest 字段）。
   为什么要它：下载只校验字节数的话，走代理时被中间人换掉一个"同样大小"的木马也能过。
   改这两个值必须同时改 release 资产，否则所有用户第一次运行就报校验失败。 */
const FILES = [
  {
    name: "screenrec-agent.exe",
    size: 34474944,
    tag: VERSION,
    sha256: "2d634e1885a82baa0495250c6cc0aa9a566403b3343e6462c260c8cc4a228c3a",
  },
  {
    name: "ffmpeg.exe",
    size: 211091968,
    tag: FFMPEG_TAG,
    sha256: "74db6c184a03dba2bdfe23e1a1f41cf5a8385bc1de6a7a1b26db1dc541abef93",
  },
];

/* 缓存目录不带版本号：exe 随版本换，ffmpeg（201 MB）不该跟着重下。
   版本用 .bin-version 标记区分，换版本时只删 exe。 */
function cacheDir() {
  if (process.env.SCREENREC_CACHE) return process.env.SCREENREC_CACHE;
  const base = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || ".", "AppData", "Local");
  return path.join(base, "screenrec-agent", "bin");
}

function markerPath() {
  return path.join(cacheDir(), ".bin-version");
}

function log(msg) {
  process.stderr.write(`[screenrec-agent] ${msg}\n`);
}

function human(n) {
  return (n / 1048576).toFixed(0) + " MB";
}


function proxyOf() {
  return process.env.HTTPS_PROXY || process.env.https_proxy ||
         process.env.HTTP_PROXY || process.env.http_proxy || "";
}

/* Node 的 https 不认 HTTP(S)_PROXY，而国内用户几乎都靠代理。
   这里手写 CONNECT 隧道：先跟代理建隧道，再在隧道上跑 TLS。 */
function getThrough(url, opts, onResponse) {
  const proxy = proxyOf();
  const target = new URL(url);
  // 连接层失败（拒绝连接 / DNS 失败 / 代理挂了）必须交回 download() 走重试，
  // 否则 Node 会把 'error' 当成未处理事件直接崩掉整个进程 —— 用户只看到一堆堆栈。
  let done = false;
  const once = (res) => { if (!done) { done = true; onResponse(res); } };
  if (!proxy) {
    const direct = https.get(url, opts, once);
    direct.on("error", (e) => once(Object.assign(e, { statusCode: undefined })));
    return direct;
  }

  const p = new URL(proxy);
  const useTls = p.protocol === "https:";
  const mod = useTls ? https : http;
  const port = p.port || (useTls ? 443 : 80);

  const req = mod.request({
    host: p.hostname, port, method: "CONNECT",
    path: `${target.hostname}:443`,
    headers: { Host: `${target.hostname}:443` },
  });
  req.on("error", (e) => once(Object.assign(e, { statusCode: undefined })));
  req.on("connect", (res, socket) => {
    if (res.statusCode !== 200) {
      socket.destroy();
      return onResponse(Object.assign(new Error(`proxy CONNECT ${res.statusCode}`), { statusCode: res.statusCode }));
    }
    const r = https.request({
      host: target.hostname, port: 443, path: target.pathname + target.search,
      method: "GET", headers: opts.headers, agent: false, socket, servername: target.hostname,
    }, onResponse);
    r.on("error", (e) => onResponse(e));
    r.end();
  });
  req.on("error", (e) => onResponse(e));
  req.end();
}

/* 下载：断流可续传、无进展自动重连。
   为什么必须这样：国内拉 GitHub release 的大文件经常中途断流，而 Node 在连接
   僵住时既不抛错也不结束 —— 没有看门狗就永远停在原地。
   实测：201 MB 的 ffmpeg 卡在 10.2 MB 之后 18 分钟零字节，进度条一动不动。
   规则：① 写 .part，续传用 Range ② 25 秒无新字节就重连 ③ 最多 8 次
        ④ 字节数到位才改名 ⑤ 服务器不认 Range 就自动从头来 */
const STALL_MS = 25000;
const MAX_ATTEMPTS = 8;

function download(url, dest, expectSize, label, attempt) {
  attempt = attempt || 1;
  const tmp = dest + ".part";
  const have = () => { try { return fs.statSync(tmp).size; } catch (_) { return 0; } };

  return new Promise((resolve, reject) => {
    const start = have();
    if (expectSize && start >= expectSize) {
      try { fs.renameSync(tmp, dest); } catch (_) {}
      return resolve(dest);
    }

    const headers = { "User-Agent": "screenrec-agent-npm" };
    if (start > 0) {
      headers.Range = "bytes=" + start + "-";
      log(label + ": resuming at " + human(start) + " (attempt " + attempt + ")");
    }

    let settled = false;
    const retry = (msg) => {
      if (settled) return;
      settled = true;
      if (attempt >= MAX_ATTEMPTS) return reject(new Error(label + ": " + msg + " (after " + attempt + " attempts)"));
      log(label + ": " + msg + " — 重连中 (" + attempt + "/" + MAX_ATTEMPTS + ")");
      setTimeout(() => {
        download(url, dest, expectSize, label, attempt + 1).then(resolve, reject);
      }, Math.min(500 * attempt, 4000));
    };

    const go = (u, hops) => {
      hops = hops || 0;
      if (hops > 6) return retry("too many redirects");
      getThrough(u, { headers: headers }, (res) => {
        if (!res || res.statusCode === undefined) {
          return retry((res && res.message) || "connection failed");
        }
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(new URL(res.headers.location, u).toString(), hops + 1);
        }
        if (res.statusCode === 416) {
          try { fs.unlinkSync(tmp); } catch (_) {}
          return retry("range not satisfiable");
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume();
          return retry("HTTP " + res.statusCode);
        }

        const append = res.statusCode === 206 && start > 0;
        let got = append ? start : 0;
        let lastPct = expectSize ? Math.floor((got / expectSize) * 100) : -1;
        const out = fs.createWriteStream(tmp, { flags: append ? "a" : "w" });

        // 看门狗：HTTP 连接断流时 Node 不会报错，只会僵住
        res.setTimeout(STALL_MS, () => res.destroy(new Error("stalled")));

        res.on("data", (c) => {
          got += c.length;
          if (!expectSize) return;
          const pct = Math.floor((got / expectSize) * 100);
          if (pct >= lastPct + 10 || pct === 100) {
            lastPct = pct - (pct % 10);
            log(label + " " + pct + "% (" + human(got) + ")");
          }
        });
        res.on("error", (e) => { out.destroy(); retry(e.message || "stream error"); });
        res.on("aborted", () => { out.destroy(); retry("connection aborted"); });
        res.pipe(out);
        out.on("error", (e) => retry(e.message));
        out.on("finish", () => out.close(() => {
          if (expectSize && got < expectSize * 0.9) return retry("truncated (" + got + " of " + expectSize + ")");
          try { fs.renameSync(tmp, dest); } catch (e) { return retry(e.message); }
          settled = true;
          resolve(dest);
        }));
      });
    };
    go(url, 0);
  });
}

/* ── SHA256 校验 ──────────────────────────────────────────────
   每个文件在一台机器上只哈希一次，结果记进 .verified.json：
   34 MB 的 exe 每次启动都算无所谓，201 MB 的 ffmpeg 每次都算会拖慢启动。
   校验不过就删掉文件 —— 留在磁盘上只会让人以为"已经有本地副本了"。 */
function sha256File(p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(p, { highWaterMark: 1 << 20 });
    s.on("error", reject);
    s.on("data", (c) => h.update(c));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

function verifiedPath() {
  return path.join(cacheDir(), ".verified.json");
}

function loadVerified() {
  try { return JSON.parse(fs.readFileSync(verifiedPath(), "utf8")) || {}; } catch (_) { return {}; }
}

function saveVerified(o) {
  try { fs.writeFileSync(verifiedPath(), JSON.stringify(o, null, 2)); } catch (_) {}
}

async function checkFile(f, p) {
  const got = await sha256File(p);
  if (got === f.sha256) return true;
  log(`${f.name}: SHA256 校验失败`);
  log(`  期望 ${f.sha256}`);
  log(`  实际 ${got}`);
  log(`  已删除 —— 要么下载被截断，要么文件在传输中被换过`);
  try { fs.unlinkSync(p); } catch (_) {}
  return false;
}

async function ensureBinary() {
  const dir = cacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const exe = path.join(dir, "screenrec-agent.exe");

  // 老版本缓存目录（bin/v0.1.x/）里可能已经有 ffmpeg —— 搬进新目录，别重下 201 MB
  try {
    const ff = path.join(dir, "ffmpeg.exe");
    if (!fs.existsSync(ff)) {
      for (const d of fs.readdirSync(dir)) {
        if (!/^v\d/.test(d)) continue;
        const cand = path.join(dir, d, "ffmpeg.exe");
        try {
          if (fs.statSync(cand).size > 100 * 1048576) { fs.renameSync(cand, ff); break; }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // 外壳换了版本 → exe 一定要换；ffmpeg 是钉死的大件，留着别重下
  let have = "";
  try { have = fs.readFileSync(markerPath(), "utf8").trim(); } catch (_) {}
  if (have !== VERSION) {
    for (const f of FILES) {
      if (f.name === "ffmpeg.exe") continue;
      for (const p2 of [path.join(dir, f.name), path.join(dir, f.name) + ".part"]) {
        try { fs.unlinkSync(p2); } catch (_) {}
      }
    }
  }

  // 先校验已有缓存，再判断缺什么 —— 校验删掉的文件才会被算进 missing 里重下
  const ver = loadVerified();
  let dirty = false;
  for (const f of FILES) {
    const p = path.join(dir, f.name);
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).size !== f.size) continue; // 大小都不对，交给 missing 逻辑
    if (ver[f.name] === f.sha256) continue;       // 这台机器上验过了
    log(`verifying ${f.name} …`);
    if (await checkFile(f, p)) { ver[f.name] = f.sha256; dirty = true; }
    else { delete ver[f.name]; dirty = true; }
  }
  if (dirty) saveVerified(ver);

  const missing = FILES.filter((f) => {
    const p = path.join(dir, f.name);
    return !fs.existsSync(p) || fs.statSync(p).size < f.size * 0.9;
  });

  if (missing.length === 0) {
    try { fs.writeFileSync(markerPath(), VERSION); } catch (_) {}
    return exe;
  }

  const mbytes = Math.round(missing.reduce((a, f) => a + f.size, 0) / 1048576);
  log(`first run — downloading ${missing.map((m) => m.name).join(", ")} (~${mbytes} MB) into ${dir}`);
  for (const f of missing) {
    const url = process.env.SCREENREC_BASE_URL
      ? `${process.env.SCREENREC_BASE_URL}/${f.name}`
      : `https://github.com/${OWNER}/${REPO}/releases/download/${f.tag}/${f.name}`;
    log(`fetching ${url}`);
    await download(url, path.join(dir, f.name), f.size, f.name);
    if (!(await checkFile(f, path.join(dir, f.name)))) {
      throw new Error(
        `${f.name} 校验失败：下载到的东西和发布时的 SHA256 不一致，已删除。\n` +
        `  这通常意味着传输被劫持或文件被换过 —— 检查组网环境（代理 / VPN / 公共 WiFi），换一个网络重试。\n` +
        `  如果多次重试都失败，请到 https://github.com/${OWNER}/${REPO}/releases 手动下载并核对哈希。`
      );
    }
    ver[f.name] = f.sha256;
  }
  saveVerified(ver);
  try { fs.writeFileSync(markerPath(), VERSION); } catch (_) {}
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
