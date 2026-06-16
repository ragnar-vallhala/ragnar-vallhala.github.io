---
title: "I Wrote an FFT to Play Music: An Over-Engineered Terminal Player"
date: 2026-06-16
description: "The browser ate gigabytes to play a song, so I wrote a 2,000-line terminal music player with no pip deps. Along the way it grew a hand-rolled Fourier transform, a filesystem-as-LRU cache, two mpv processes, and an LLM that scores my songs by vibes. A field report on accidental over-engineering."
tags: [python, curses, terminal, mpv, mcp, over-engineering]
---

The browser was the problem. I keep one tab open for music — YouTube, a song, nothing else. That one tab held two gigabytes hostage. A DOM, a JavaScript engine, a video decoder, all of it just to move air.

So I did the reasonable thing and wrote a terminal music player. Pure Python standard library, no pip packages. It shells out to `yt-dlp`, `mpv`, and `ffmpeg`, and draws a curses UI. That was the whole plan.

The plan held for about a day.

What I have now is **`tuna.py`, 2,131 lines**, plus a **792-line MCP server**. Nearly 3,000 lines for "a music player." It contains a from-scratch Fast Fourier Transform. It drives two `mpv` processes over Unix sockets. It uses the filesystem's mtimes as an LRU cache. And it hands my songs to a language model that scores them by mood and remembers the verdict forever.

This is the story of how a RAM complaint became all of that.

![tuna's curses TUI — the results pane on the left, the help panel and a cache-age histogram on the right, a Braille portrait, and the red spectrum analyzer painted along the footer](/blogs/tuna/tui.png)

Everything in that screenshot was a detour. The red bars along the bottom are a Fourier transform. The little histogram on the right is the cache, plotted by age. The face is Braille. We'll get to all of it.

---

## 1. The modest core

Start with the part that was justified.

`mpv` is the player, and tuna controls it over a **Unix-domain socket** — mpv's JSON IPC channel. The launch line is plain:

```
mpv --idle=yes --no-video --no-terminal --really-quiet \
    --volume=80 --cache=yes --input-ipc-server={sock}
```

`--no-video` is the whole pitch. No video track is fetched or decoded, so there is nothing to render. The cost is the audio and nothing else.

The `MPV` class is a tidy IPC client. A reader thread does `recv(65536)` and splits mpv's newline-delimited JSON into two kinds of message. Replies get matched by `request_id`. Async events get pushed onto a `queue.Queue`. Every `command()` registers a `threading.Event` and waits three seconds for its reply — synchronous calls over an async wire.

Auto-advance falls out of this for free. A separate event loop blocks on the queue, and when mpv emits `end-file` with reason `eof`, the next song plays. It's event-driven, not a polling timer.

This part I stand by. It's small and it does one thing.

Then I wanted the next song to start *instantly*.

---

## 2. The cache that is just `mtime`

Instant means no network at the moment of truth. So songs download once, as mp3s, into `~/.config/tuna/cache/<video-id>.mp3`. After that they play from disk forever.

I expected to build an index — a little database, with last-played timestamps, a recency table, eviction bookkeeping.

I built none of that. **The filesystem already has it.**

The LRU key is the file's mtime. `cache_files()` lists the mp3s and sorts them by `os.path.getmtime`. Every play calls `os.utime(path, None)`, which touches the file and bumps its recency. Eviction lists the oldest and deletes down to a 100-song cap. The cache has no state of its own — the directory *is* the data structure.

One detail I'm quietly proud of. Downloads run `yt-dlp --no-part`, so the final `<id>.mp3` only appears after a complete, converted download. "Does this file exist" and "is this song fully cached" become the same question. There are no half-written files to misread. Existence is truth.

Two threads can want the same song at once — you press play on a track a background worker is already fetching. A lock guards a set of in-flight ids. The second caller sees the id is taken and waits, polling for the file for up to five patient minutes. One network hit, shared.

Which brings up the background worker. Workers, plural.

---

## 3. Two prefetchers, because one wasn't enough

I wanted the queue to survive going offline — not just the list, the audio.

So a daemon thread wakes every two seconds and downloads the upcoming queue, one track at a time. It's deliberately timid. It checks the same lock first, and if any foreground download is in flight, it does nothing. It never races the song you're waiting on. It only fills idle moments.

That handles the whole queue, lazily. But the *next* track is special, because EOF is about to need it. So it gets its own eager prefetch the moment the current song resolves. Two mechanisms — one patient and broad, one immediate and narrow. Between them, the next mp3 is on disk before EOF and the load is instant.

This is the "gapless" the README brags about. There's no real gapless config. It's the cache, dressed up.

So far, defensible: a player that's quiet, offline-capable, and instant. I could have stopped.

I did not stop. I decided it needed to *look* like music.

---

## 4. The part where I wrote a Fourier transform

A spectrum analyzer. Bars that dance to the song. In a terminal. How hard could it be.

The first problem is that mpv won't hand me the PCM samples over IPC — it plays audio but hides the waveform. So the visualizer goes *around* mpv. A thread wakes every 60ms, reads mpv's `time-pos`, and decodes a window of the cached mp3 at that timestamp. ffmpeg gives it back as raw `s16le` mono.

Seeking ffmpeg to an exact sample is its own small war. A coarse seek before `-i` is fast, but it lands on primed, zeroed samples and you get silence at the seam. So it seeks twice: a coarse input-seek to half a second early, then a fine output-seek after `-i` to land precise. Ugly, but necessary — the bars would stutter without it.

Then the actual signal processing. A Hann window, then a **recursive radix-2 Cooley–Tukey FFT**, written by hand in pure Python. numpy would have broken the no-dependencies rule I made up for myself.

```python
def _fft(a):
    n = len(a)
    if n <= 1:
        return a
    even = _fft(a[0::2])
    odd  = _fft(a[1::2])
    # ... twiddle factors, butterflies ...
```

The magnitudes fold into 64 log-spaced bars with running auto-gain on top. They draw with nine sub-cell blocks — `" ▁▂▃▄▅▆▇█"` — for resolution finer than one character cell. A fast-attack, slow-decay envelope smooths them, so the bars snap up and sink slow. A red gradient runs up each one across six custom color pairs, hot at the base and pale at the peaks. On pause they decay to a flat line. That red ribbon along the footer up top is it, mid-song.

Let me be clear about what happened. To make a music player *look* like one, I decode audio out-of-band, run a Fourier transform I wrote from scratch, and paint the result in sub-character Unicode with a hand-tuned envelope and a custom color ramp. The original sin was a browser using too much RAM.

The frame rate even adapts — ~15fps while the spectrum animates, a lazy 4fps when nothing moves. I optimized the render loop of a feature I had no reason to build.

---

## 5. Two mpv processes walk into a terminal

Audio-only was the entire point. Then I wanted to watch the occasional video without leaving.

Press `v`. tuna drops out of curses with `def_prog_mode()` and `endwin()`, hands the raw terminal to a *second* mpv, and blocks. On kitty, that mpv runs `--vo=kitty`, so video renders inside the terminal — no window, no X11. Quit mpv and curses comes back exactly as it was.

The second mpv isn't a dumb viewer. It has its own IPC socket and reader thread, and it follows the queue. On end-of-file it resolves the next video and loads it, keeping the TUI's now-playing state in sync. A fully independent, queue-aware player that borrows the terminal and gives it back.

So now there are two mpv processes and two IPC clients — for a thing that started life as `--no-video`.

---

## 6. I gave the music player a language model

This is the one I can least defend and like the most.

There's a companion, `tuna_mcp.py`, an MCP server so an assistant can DJ. It speaks **JSON-RPC 2.0 over stdio**, hand-rolled, no SDK. It reads stdin line by line, dispatches, and writes JSON to stdout, with diagnostics on stderr so the protocol stays clean. It implements `initialize`, `tools/list`, and `tools/call` by hand, with the right error codes. It imports `tuna` and reuses the real playback logic headless. Around 25 tools: search, play, queue, the nested-folder playlists.

And then, the emotional index.

The assistant scores each song on **valence, energy, danceability, and acousticness** — Spotify's audio features — plus a mood, a category, and tags. Except there's no audio analysis. The *language model* assigns the numbers by vibes, writes them to `song_index.json`, and never recomputes them. Two rules, both deliberate: **once per song**, and **only when you ask**. No background AI, nothing automatic.

From that index it reads your library's tone. It averages the dimensions, drops them in a valence/energy quadrant, and out comes `"melancholic / mellow"` or `"intense / dark"`. It filters to your calm, high-valence songs. It stages suggestions in a JSON file the TUI loads only when you press `g`.

The server and the player never talk live. They pass small JSON files in a config directory — index once, load on demand, fully decoupled. I designed a clean integration boundary so a language model could rate my songs by feel.

---

## 7. A tally of the damage

What "a music player" turned into:

| Thing | Count |
|---|---|
| Lines, `tuna.py` | 2,131 |
| Lines, `tuna_mcp.py` | 792 |
| pip dependencies | 0 |
| Long-lived daemon threads, per session | 5 |
| `mpv` processes (audio + video) | 2 |
| Hand-written Fourier transforms | 1 |
| LLM-as-music-critic backends | 1 |

Five daemon threads hum along in a normal session: the event loop, the autosave, the queue prefetcher, the visualizer, and mpv's reader. Session state saves every five seconds, atomically — temp file, then rename, crash-safe, for a toy. On restart the last song reloads *paused at the exact position you left it*, so it never blasts audio when a terminal opens. Playlists are real nested folders with path-traversal-safe sanitization. There's a cut/copy/paste clipboard across panes, and a Braille portrait in the help screen.

None of this was the plan. The plan was to stop the browser from eating two gigabytes to play a song.

---

## 8. Was it worth it

The RAM thing? Genuinely solved. tuna idles in single-digit megabytes, plays offline, and survives a reboot mid-song. I use it every day and the browser tab is gone. By its stated goal, total success.

Everything past Section 3 was not the goal — it was the goal *giving me cover*. A music player is permission to write a spectrum analyzer. A spectrum analyzer is permission to write an FFT. "No dependencies" is permission to write the FFT *by hand*. Each step is small and reasonable, and 2,000 lines later there's a Cooley–Tukey butterfly in your audio player.

I don't think this is a failure mode. I think it's the point. The browser tab would have worked, but it would have taught me nothing. This taught me mpv's IPC protocol, the seam in ffmpeg's seek, how little a curses UI costs, and how an FFT folds frequencies into bins. The over-engineering *was* the project. The music was the excuse.

It's on [GitHub](https://github.com/ragnar-vallhala/tuna). Bring your own `mpv`.
