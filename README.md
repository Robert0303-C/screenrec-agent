# Screen Recorder MCP

**Let your AI agent record a real browser page and cut it into a publishable vertical video.**

An MCP server for Claude Code, Cursor, Codex and Hermes. Your agent records a page over CDP (no browser
extension, no permission dialog), then composes the clip: device frame, held-frame callouts, punch-ins,
captions, music with real ducking, end card.

Everything runs locally. No upload, no API key, no cloud render.

```
录制 → 设备框 → 冻结圈注 → 局部放大 → 字幕 → 结尾卡 → 成片
```

## Why this exists

Every "AI video" tool generates pixels and hopes the text survives. This one doesn't generate anything:
it records your actual UI and draws text with a font engine. **Every digit is your real number.**

The agent-facing part is the point: an agent can produce a finished clip as a tool call, not a chat
suggestion.

## Tools

| Tool | What it does |
|---|---|
| `recorder_status` | recording state, bytes, bridge status |
| `recorder_start` | start recording a tab (Chrome requires one human click — see below) |
| `recorder_stop` | stop and save to Downloads |
| `recorder_files` | list recent recordings |
| `compose_clip` | the actual product: record → finished video |

`compose_clip` takes `captions`, `annotations` (held-frame callouts), `focus` (punch-ins), `end_title`,
`music`, `frame` (phone/browser), `pip` (picture-in-picture).

## Install

1. Download `screenrec-agent-v0.1.0-win64.zip` from Releases
2. Unzip anywhere (e.g. `D:\ScreenRecAgent`)
3. Add to your MCP client config:

```json
{
  "mcpServers": {
    "screen-recorder": {
      "command": "D:\\ScreenRecAgent\\screenrec-agent.exe"
    }
  }
}
```

4. `screenrec-agent.exe --selftest` to verify the install

## The one gesture Chrome insists on

`chrome.tabCapture` needs `activeTab`, and `activeTab` only comes from invoking the extension on that tab.
No script can fake it (verified: even a trusted CDP click inside an extension page fails). So:

- **Page recording** (CDP) — fully autonomous, no click, no extension
- **Desktop + microphone recording** (extension) — the human clicks the toolbar icon once, the agent
  handles everything after

## Requirements

- Windows 10/11 x64
- ~300 MB disk
- An MCP client

## Roadmap

- [x] CDP recording, freeze-frame callouts, punch-ins
- [x] Device frame, captions, end card, music ducking, picture-in-picture
- [ ] Voice-over (piper, EN + ZH) — Full edition
- [ ] macOS

## License

Commercial. Source available for review; redistribution of the packaged binary is not permitted.
