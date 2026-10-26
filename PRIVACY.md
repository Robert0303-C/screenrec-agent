# Privacy Policy — xukunAI Screen Recorder MCP

_Last updated: 2026-10-26_

## What this software does with your data

**Nothing leaves your machine.** The application records a browser tab or window, renders video
locally with ffmpeg, and writes the result to a path you choose. There is no analytics, no telemetry,
no crash reporting, and no upload of video, audio, screenshots or filenames.

The only outbound network requests the software makes are:

1. **First-run download** of the application binary and its ffmpeg build, from this repository's
   GitHub Releases.
2. **License activation** — a single request when you run `screenrec-agent --activate <KEY>`,
   containing your license key and a hashed machine identifier. No personal data, no file contents.

If you never activate a license, the software makes no request other than the first-run download.

## What the seller (Creem) processes

Purchases are handled by **Creem** as the merchant of record. Creem processes your name, email
address, billing details and payment information to complete the sale, issue your license key and
comply with tax law. The seller receives your email address, order details and license key status —
never your payment card details.

Creem's own privacy policy applies to that processing.

## What is stored on your machine

- the downloaded binary and ffmpeg (in `%LOCALAPPDATA%\screenrec-agent\`)
- trial state: a timestamp and a clip counter, written to a state file and two registry values
- your license record, if you activated one

You can delete all of it by removing that folder and the `HKCU\Software\ScreenRecAgent`
registry key. Deleting trial state resets the free trial — we do not verify this online, because
we would rather not run a server that watches how you use the software.

## Contact

support@xukun.online
