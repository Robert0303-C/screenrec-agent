Screen Recorder — Agent Edition  v0.1.0
======================================

让 AI 智能体直接录制网页/桌面，并自动剪成可发布的产品视频。

Contents
--------
  screenrec-agent.exe    MCP 服务端（智能体通过它调用录屏与出片） 32 MB
  ffmpeg.exe             视频编码（唯一的外部依赖）              201 MB
  README.txt / README.md
  setup-mcp.cmd          打印 MCP 配置片段

Quick start (2 minutes)
-----------------------
1. 解压到一个固定目录，例如 D:\ScreenRecAgent
2. 双击 setup-mcp.cmd，把打印出来的 JSON 粘到你的 MCP 客户端配置里
   · Claude Code / Cursor / Codex 都是 "mcpServers" 这一节
   · Hermes 见 docs 的 mcp_servers 配置
3. 在智能体里说："用 screen-recorder 工具把这个页面录成 15 秒竖版视频"

Self test
---------
  screenrec-agent.exe --selftest
  会依次检查：本地桥 → 浏览器扩展 → 录屏文件 → 合成出片

Voice-over
----------
本（Lite）版不含语音合成。需要旁白请安装 Full 版（内置 piper + 中英语音模型）。
Lite 版调用 voice 参数会返回明确提示（不会静默失败），其余功能不受影响。

What works without a browser extension
--------------------------------------
  · 录制网页（CDP 逐帧，无需任何授权点击）
  · 设备框、冻结圈注、局部放大、字幕、结尾卡、音乐、音效
  · 画中画（第二画面）

What needs the browser extension
--------------------------------
  · 录桌面 / 录带麦克风的真实使用过程
  · 受 Chrome 限制，开始录制必须由人点一次工具栏图标；其余步骤全自动

Requirements
------------
  Windows 10/11 x64
  磁盘：约 250 MB（32 MB 程序 + 201 MB ffmpeg）
  首次运行会生成 %LOCALAPPDATA%\screen-rec\ 下的缓存

Notes
-----
  · 全部本地运行，不上传任何画面与音频
  · 需要联网的情况只有：下载浏览器扩展（可选）

Support
-------
  出问题请附上 screenrec-agent.exe --selftest 的完整输出。
