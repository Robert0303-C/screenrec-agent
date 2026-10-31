# Screen Recorder — Agent Edition · 中文使用说明

给买家和他们的智能体看。仅支持 Windows x64。

> English version: [USAGE.md](USAGE.md)

---

## 1. 它是干什么的

让**智能体自己录一个真实的浏览器标签页**，再把这段素材做成可以直接发布的成片：
统一画幅、时间轴字幕、圈注标记、画中画或等权分屏（可以和另一段录制拼在一起）、
结尾卡、背景音乐，可选旁白。

**不生成任何画面。**屏幕上出现的每个数字都是客户真实页面上的数字。

---

## 2. 安装（30 秒）

**方式一：交给智能体装**

```json
{
  "mcpServers": {
    "screenrec": { "command": "npx", "args": ["-y", "screenrec-agent"] }
  }
}
```

**方式二：先用命令行确认一下**

```bash
npx -y screenrec-agent --status
```

首次运行会把两个二进制下到 `%LOCALAPPDATA%\screenrec-agent\bin\`（约 234 MB：本体 + 内置
ffmpeg），下完立刻比对启动器里钉死的 SHA256——**不匹配就删掉并报错**，不会带着可疑文件继续跑。

官方来源只有三个：npm 上的 `screenrec-agent`、GitHub Release、MCP Registry 的
`io.github.Robert0303-C/screenrec-agent`。其他渠道出现的同名包都不作数。

---

## 3. 五个工具

| 工具 | 作用 | 需要人手点 |
|---|---|---|
| `recorder_status` | 录制状态、已录字节、本地桥是否在线 | 否 |
| `recorder_start` | 开始录当前标签页 | **是，一次**（见下） |
| `recorder_stop` | 停止并保存到「下载」 | 否 |
| `recorder_files` | 列出最近的作品 | 否 |
| `compose_clip` | **出片**（收费的那一步） | 否 |

**为什么 `recorder_start` 要人手点一次**：Chrome 只把 `tabCapture` 权限给经过真实用户手势的
`activeTab`，脚本调用、页面内的 `click()` 都不算。扩展会弹一条系统通知并打开一个说明页，
页面上写清楚要录的是哪个标签；用户点一下工具栏上的扩展图标，录制就自动开始。**之后全部交给智能体。**

---

## 4. `compose_clip` 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `input_path` | — | 源素材（mp4 / webm） |
| `out_path` | — | 输出路径 |
| `target` | `vertical` | `vertical` 1080×1920 · `square` 1080×1080 · `landscape` 1920×1080 |
| `captions` | `[]` | `[{start, end, text}]`，单位秒 |
| `annotations` | `[]` | 定格标注：`style` = `ring` / `box` / `arrow` / `none` |
| `focus` | `[]` | 推近：`{start, end, x, y, zoom, ramp}` |
| `end_title` / `end_sub` | — | 结尾卡文案 |
| `music` | — | 自动循环、淡入淡出、压在 −30 dB 左右 |
| `voice` | — | `{script, start, model}`，本地 TTS，放不下会自动加速 |
| `sfx` | `[]` | `[{file, at, volume}]` |
| `frame` | `none` | 设备框 `phone` / `browser`（要求源画幅与目标画幅一致） |
| `pip` | — | 画中画浮窗 |
| `split` | — | **等权分屏：和另一段录制同屏对照** |
| `frame_size` | `0.83` | 设备框在画面中的占比 |

### `split` —— 两段录制同屏对照

```json
"split": { "source": "C:/rec/b.webm", "ratio": 0.5, "gap": 6 }
```

方向跟着画布走，**不用自己选**：

| target | 布局 |
|---|---|
| `vertical`（9:16） | **上下分** —— A 在上面，B 在下面 |
| `landscape`（16:9） | **左右分** —— A 在左，B 在右 |
| `square`（1:1） | 上下分 |

- `ratio` 决定分割比例：0.5 是等权，0.7 表示 A 占七成。
- `gap` 是中间那道黑缝，单位像素。
- 第二段素材会被循环到与第一段等长。
- **分屏不能和 `frame` 同时用**（会套两层边框），代码会直接报错提醒。
- 分屏之后，`annotations` / `focus` 的坐标是**整张画布**的坐标：
  上半区 `y < H/2`、下半区 `y > H/2`；横版按左右分，`x < W/2` 是 A。

### `pip` —— 主画面 + 角落小窗

```json
"pip": { "source": "C:/rec/input.webm", "corner": "br",
         "width": 0.38, "start": 1.0, "end": 9.0, "shape": "rounded" }
```

`corner`：`br|bl|tr|tl` · `shape`：`rounded|circle` · `width` 是相对画布宽度的比例
（0.34 在 1080 宽画布上约 367 px，确实偏小；要让对方看清就调到 0.5–0.6）。

---

## 5. 四个常用配方

**① 竖版发片**

```json
{ "target": "vertical",
  "captions": [{"start":0.6,"end":4.2,"text":"一次调用出成片"}],
  "end_title": "完成", "end_sub": "1080×1920 · 字幕 · 结尾卡" }
```

**② 前后对比（竖版上下分）**

```json
{ "target": "vertical",
  "split": { "source": "C:/rec/after.webm", "ratio": 0.5, "gap": 6 },
  "captions": [{"start":1.0,"end":5.0,"text":"上：改版前 · 下：改版后"}] }
```

**③ 圈注讲解（画面定格 + 红圈）**

```json
{ "target": "vertical",
  "annotations": [{"start":3.0,"end":5.5,"x":540,"y":620,"r":110,
                   "style":"ring","text":"就是这一行"}] }
```

**④ 功能演示 + 角落放输入源**

```json
{ "target": "vertical", "frame": "browser",
  "pip": { "source":"C:/rec/form-input.webm", "corner":"br", "width":0.42,
           "start":1.2, "end":8.0 } }
```

---

## 6. 试用与授权

- **录制永久免费**：不限次数、不限时长、全质量。
- **出片受限**：试用 **24 小时或 5 条**（先到为准），全质量、无水印。计时从**第一次成功出片**开始。
- 试用结束后，`compose_clip` 返回结构化的 `license_required`（含购买链接），不会静默失败；
  **录制类工具照常可用**。
- 授权：**$39 一次性**，最多 **3 台机器**。激活只联网一次，之后所有判断都在本地、离线可用。
- `--status` 查看试用/授权状态 · `--activate <KEY>` 激活。

---

## 7. 已知限制

| 限制 | 原因 |
|---|---|
| 仅 Windows x64 | 录制端在本机驱动 Chrome + ffmpeg |
| `recorder_start` 要人手点一次 | Chrome 的 `activeTab` 手势要求 |
| `frame` 要求源画幅与目标一致 | 否则设备框里会出现双层黑边 |
| `split` 与 `frame` 互斥 | 给分屏再套边框会很难看 |
| 首次运行要下约 234 MB | 内置 ffmpeg；之后走缓存，不会重复下载 |
| 长素材出片慢 | 纯 CPU 渲染，双核笔记本大约 1× 实时 |

---

## 8. 故障排查

**首次运行卡住** —— 启动器支持断点续传（HTTP Range）、25 秒无字节自动重连、最多 8 次。
网络实在差，可以设环境变量 `SCREENREC_BASE_URL` 指向一个镜像目录。

**报「SHA256 校验失败」** —— 下载到的文件与发布摘要不一致，已被删除。检查网络环境
（代理 / VPN / 公共 WiFi）后重试；多次失败就去 GitHub Release 手动下载并核对哈希。

**`recorder_start` 返回 `needsGesture`** —— 扩展已把请求排进队列，去点一下工具栏图标即可。

**出片没反应** —— 先调 `recorder_status`：如果 `bridge_connected: false`，说明本地桥没起来，
先启动一次录制端再合成。

---

## 9. 隐私

本产品**只有一个对外请求：许可证激活**。录制、剪辑、字幕、渲染全部在这台机器上完成，
不采集、不上传任何屏幕内容或文件，也没有任何遥测。

---

*配套英文版：[USAGE.md](USAGE.md) · 更新日期 2026-10-31*
