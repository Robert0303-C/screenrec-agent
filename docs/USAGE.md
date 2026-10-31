# Screen Recorder — Agent Edition · Usage Guide

For buyers and their agents. Windows x64 only.

> 中文版：[USAGE.zh.md](USAGE.zh.md)

---

## 1. What it does

An agent records a **real browser tab** and renders the footage into a publishable clip:
fixed aspect ratio, timed captions, callout markers, picture-in-picture or side-by-side
split with a second recording, end card, music, optional voice-over.

No generated pixels. Every number on screen is the customer's real number.

---

## 2. Install (30 seconds)

**Option A — let the agent install it**

```json
{
  "mcpServers": {
    "screenrec": { "command": "npx", "args": ["-y", "screenrec-agent"] }
  }
}
```

**Option B — CLI check before wiring it up**

```bash
npx -y screenrec-agent --status
```

First run downloads two binaries into `%LOCALAPPDATA%\screenrec-agent\bin\`
(~234 MB: the tool + a bundled ffmpeg), then verifies their SHA256 against the
values pinned in the launcher. A mismatch deletes the file and fails loudly.

Official sources only: npm `screenrec-agent`, GitHub releases, the MCP Registry
entry `io.github.Robert0303-C/screenrec-agent`.

---

## 3. The five tools

| Tool | What it does | Human click needed |
|---|---|---|
| `recorder_status` | recording state, bytes recorded, bridge online | no |
| `recorder_start` | start recording the current tab | **yes**, once (see below) |
| `recorder_stop` | stop and save to Downloads | no |
| `recorder_files` | list recent recordings | no |
| `compose_clip` | **render the finished clip** (the paid step) | no |

`recorder_start` needs one click on the extension icon: Chrome only grants
`tabCapture` to an `activeTab` after a real user gesture. The extension posts a
system notification and opens a page showing which tab will be recorded; the
recording starts by itself once the human clicks the icon. Everything after that
is the agent.

---

## 4. `compose_clip` parameters

| Parameter | Default | Notes |
|---|---|---|
| `input_path` | — | source recording (mp4/webm) |
| `out_path` | — | where to write the result |
| `target` | `vertical` | `vertical` 1080×1920 · `square` 1080×1080 · `landscape` 1920×1080 |
| `captions` | `[]` | `[{start, end, text}]`, seconds |
| `annotations` | `[]` | freeze-frame callouts: `style` = `ring` / `box` / `arrow` / `none` |
| `focus` | `[]` | push-in: `{start, end, x, y, zoom, ramp}` |
| `end_title` / `end_sub` | — | end card text |
| `music` | — | loops, fades, sits around −30 dB |
| `voice` | — | `{script, start, model}` — local TTS, auto-accelerated to fit |
| `sfx` | `[]` | `[{file, at, volume}]` |
| `frame` | `none` | `phone` / `browser` device frame (source must match the target ratio) |
| `pip` | — | picture-in-picture overlay |
| `split` | — | **equal-weight split screen with a second recording** |
| `frame_size` | `0.83` | device frame size within the canvas |

### `split` — compare two recordings

```json
"split": { "source": "C:/rec/b.webm", "ratio": 0.5, "gap": 6 }
```

The direction follows the canvas, so you never choose it:

| target | layout |
|---|---|
| `vertical` (9:16) | **stacked** — A on top, B below |
| `landscape` (16:9) | **side by side** — A left, B right |
| `square` | stacked |

- `ratio` splits the canvas (0.5 equal, 0.7 gives A the bigger share).
- `gap` is the black gutter in pixels.
- The second recording is looped to the length of the first.
- **Split cannot be combined with `frame`** (you would get a frame around a frame).
- After splitting, `annotations` / `focus` coordinates refer to the **whole canvas**
  (top half is `y < H/2`, bottom half `y > H/2`; landscape splits on x).

### `pip` — main shot plus a small window

```json
"pip": { "source": "C:/rec/input.webm", "corner": "br",
         "width": 0.38, "start": 1.0, "end": 9.0, "shape": "rounded" }
```

`corner`: `br|bl|tr|tl` · `shape`: `rounded|circle` · `width` is a fraction of the canvas
width (0.34 ≈ 367 px on a 1080 px canvas — raise it to 0.5–0.6 if the second feed must be readable).

---

## 5. Recipes

**Publishable vertical clip**

```json
{ "target": "vertical",
  "captions": [{"start":0.6,"end":4.2,"text":"One call renders the clip"}],
  "end_title": "Done", "end_sub": "1080×1920 · captions · end card" }
```

**Before / after comparison (vertical)**

```json
{ "target": "vertical",
  "split": { "source": "C:/rec/after.webm", "ratio": 0.5, "gap": 6 },
  "captions": [{"start":1.0,"end":5.0,"text":"left: before · right: after"}] }
```

**Explainer with a callout**

```json
{ "target": "vertical",
  "annotations": [{"start":3.0,"end":5.5,"x":540,"y":620,"r":110,
                   "style":"ring","text":"this row"}] }
```

**Feature demo with the input source in the corner**

```json
{ "target": "vertical", "frame": "browser",
  "pip": { "source":"C:/rec/form-input.webm", "corner":"br", "width":0.42,
           "start":1.2, "end":8.0 } }
```

---

## 6. Trial and licence

- Recording is **free forever** — unlimited, full quality.
- Composing is trial-limited: **24 hours or 5 clips**, whichever comes first, at full quality
  and with no watermark. The clock starts on the first successful compose.
- After that, `compose_clip` returns a structured `license_required` payload with the buy link
  instead of failing silently; the recording tools keep working.
- Licence: **$39 one-time**, up to **3 activations**. Activation needs one network call;
  every check afterwards is local and offline.
- `--status` prints the trial/licence state · `--activate <KEY>` activates.

---

## 7. Known constraints

| Constraint | Why |
|---|---|
| Windows x64 only | the recorder drives Chrome + ffmpeg locally |
| `recorder_start` needs one human click | Chrome's `activeTab` gesture requirement |
| `frame` requires the recording to match the target ratio | otherwise double letterboxing inside the frame |
| `split` replaces `frame` | a frame around a split canvas looks broken |
| First run downloads ~234 MB | bundled ffmpeg; cached afterwards, never re-downloaded |
| Very long recordings | composing is CPU-bound; a 2-core laptop renders ~1× realtime |

---

## 8. Troubleshooting

**First run stalls** — the launcher resumes partial downloads (`Range`), retries 8 times and
aborts after 25 s of no bytes. Behind a slow route, set `SCREENREC_BASE_URL` to a mirror.

**`SHA256 校验失败`** — the downloaded binary does not match the published digest, so it was
deleted. Check the network (proxy / VPN / public Wi-Fi) and retry; if it keeps failing,
download from the GitHub release and verify the hash manually.

**`recorder_start` returns `needsGesture`** — the extension has queued the request; click the
toolbar icon on the tab you want recorded.

**Nothing renders** — call `recorder_status` first: `bridge_connected: false` means the local
bridge is not up, so start the recorder once before composing.

---

## 9. Privacy

The product makes **one** external request: licence activation. Recording, trimming,
captions and rendering all happen on the machine. No screen content, no file, no telemetry
leaves the machine.

---

# 中文速查

## 装

```bash
npx -y screenrec-agent --status     # 首次会下 234 MB，校验 SHA256 后运行
```

## 五个工具

`recorder_status` 看状态 · `recorder_start` 开始录（**Chrome 要求人手点一次扩展图标**）·
`recorder_stop` 停止保存 · `recorder_files` 列作品 · `compose_clip` 出片（收费那一步）

## 出片参数速记

```
target       vertical 1080x1920 | square 1080x1080 | landscape 1920x1080
captions     字幕 [{start,end,text}]
annotations  冻结画面 + 圈/框/箭头 [{start,end,x,y,r,style,text}]
focus        推近 [{start,end,x,y,zoom}]
split        等权分屏 {"source":第二段,"ratio":0.5,"gap":6}
             竖版自动上下分、横版自动左右分
pip          画中画 {"source","corner":"br","width":0.38,"shape":"rounded"}
frame        设备框 phone/browser（要求源画幅与目标一致）
voice        旁白 {script,start}  music 音乐  sfx 音效  end_title 结尾卡
```

**三条容易踩的：**

1. 分屏不能和设备框一起用（会套两层边）
2. 分屏之后，标注坐标是**整张画布**的坐标，不是某一路的
3. 画中画默认 0.34 宽度偏小，要让对方看清就调到 0.5 以上，或者干脆用分屏

## 免费与收费

录制永久免费、无限、全质量。出片试用 **24 小时或 5 条**（先到为准），无水印。
之后 `compose_clip` 返回 `license_required`，但录制工具照常能用。
授权 **$39 一次性 / 3 台机器**，激活只联网一次。

## 隐私

唯一的对外请求是**激活**。录屏、剪辑、字幕、渲染全在本机，屏幕内容不外传。

---

*Chinese version: [USAGE.zh.md](USAGE.zh.md) · updated 2026-10-31*
