# What is free, what is paid, and what will never be free again

Written down so that nobody — including me — has to guess later.

## Three things are on offer

### 1. The MCP server, free to record

`recorder_*` is unlimited forever: open a page over CDP, record it, stop, hand back the file. No
account, no key, no trial, no upload. This is the part that makes the tool worth installing, and
gating it would only mean nobody installs it.

### 2. Turning a recording into a finished clip — trial, then $39 once

`compose_clip` is the part that does the work: device frame, held-frame callouts, punch-ins,
captions, music with real ducking, end card. The trial is 24 hours or 5 clips, whichever comes
first, starting on the first **successful** compose.

When it ends, `compose_clip` returns `license_required` with a purchase link. Recording keeps
working. Nothing is deleted. `screenrec-agent --status` shows what is left,
`screenrec-agent --activate <KEY>` unlocks it.

One purchase, no subscription, no expiry, works offline after activation. The only network call in
the whole program is activation itself.

### 3. The clip itself, made for you

If the buyer does not want software at all, I record their page, cut and caption it, and send back
one finished vertical video. Priced per clip. No install, no license, no trial — alex@saas.pet

## What the licenses do and do not cover

| Piece | License | What that means |
|---|---|---|
| `npm/bin/cli.js` — the shell that downloads the binary and forwards stdio | MIT | Anyone may copy it, fork it, or ship it inside their own tool |
| `screenrec-agent.exe` — the server, the composer, the trial and the activation | Commercial, closed source | Not in this repository, not covered by MIT, not redistributable |

The shell is MIT because a downloader is not the product; it is the thing that lets a directory
install us in one command. The product is the binary.

## Why the gate is where it is

The trial lives in the binary, on the user's machine, in three copies with clock-rollback
detection. Deleting all three is the same as a fresh install. Offline software cannot prevent that,
and the alternative — a server that watches every compose — is worse for the buyer and worse for
the seller. Being honest about the limit is cheaper than shipping surveillance.

It also means the gate is not a security boundary. Anyone determined enough will remove it. The
purchase is for people who would rather pay $39 than spend an afternoon reimplementing the
composer, which is most of the people who need this.

## What a future paid version can and cannot be

- **Can**: add genuinely new capability — voice-over, batch rendering, template packs, a hosted
  render service — and charge for that, under its own commercial license.
- **Cannot**: take something back. Everything published under MIT stays MIT, and every copy of
  `0.2.0` keeps the rights it was published with. No retroactive licensing, ever.
- **Will not**: gating the recorder, adding telemetry, or a subscription for something that runs on
  the buyer's own machine.

## The number that decides whether any of this matters

Installs, not listings. If nobody installs it, the pricing table is a fiction. Watch one figure:
usage on Smithery, thirty days after the listing goes live.
