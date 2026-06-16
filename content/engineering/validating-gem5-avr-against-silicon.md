---
title: Validating a gem5 AVR Model Against Real Silicon
date: 2026-06-12
description: How I proved a gem5 AVR model correct by diffing it against an Arduino Nano — and the bug that hid for months.
tags: [computer-architecture, gem5, embedded, validation]
draft: true
---

A simulator is only as good as your check against silicon. I had
extended [gem5](https://github.com/ragnar-vallhala/gem5) with the AVR
instruction set. It could run microcontroller workloads cycle-accurately.
But "I wrote the decoder and it runs CoreMark" proves little. Until you
diff against hardware, you are trusting your own arithmetic.

So I built
[a hardware-in-the-loop harness](https://github.com/ragnar-vallhala/avr-sim-validation).
The same binaries run two places. One is a real ATmega328P, an Arduino
Nano. That is the golden reference. The other is gem5, the device under
test. The host diffs their output byte for byte. It compares cycle
counts separately.

## Why not just run a big benchmark

The obvious move is CoreMark on both. Two problems. First, CoreMark does
not fit the ATmega328P's 2 KB of SRAM. Second, and this is the real
reason, a big benchmark hides bugs. It only exercises the instructions it
uses. It buries the rest in an aggregate score.

So I validate at three layers:

- **ISA conformance.** Apply known operands and an initial status
  register. Execute one instruction. Capture the result and the new
  `SREG`. The vectors target the flag edge cases. Carry, half-carry,
  overflow, sign, zero. Models go wrong there quietly.
- **Cycle conformance.** Per-instruction microbenchmarks. Timed on
  hardware with Timer1. Compared to gem5's `numCycles`. AVR SRAM has no
  wait states. So the expected error is exactly zero.
- **Aggregate workload.** A self-checking CRC-32 that fits 2 KB. Compare
  the checksum and the cycle count.

One discipline holds it together. Only the I/O differs between targets.
The sim uses gem5's `break` syscalls. The hardware uses USART0 at 115200
baud. The compute code is byte-identical. Same `avr-gcc 7.3.0` on both.

## The bug that CoreMark never found

First ISA run: **45 of 47**. Two mismatches, both signed multiply.
`muls` and `mulsu`. Hardware returned `0xfffe`. gem5 returned `0x0000`.

The model was not computing them wrong. It was not computing them at all.
`MULS`, `MULSU`, and the `FMUL*` family were unimplemented. Bit 9 of
opcode group `0x00` fell through to the "Unimplemented" handler.

Here is the case for hardware validation. Nothing else caught this.
CoreMark validated fine. The avr-gdb diff was clean. The cycle audit
passed. Why? **CoreMark only uses unsigned `mul`.** The bug lived in a
blind spot every check shared. Only signed-multiply vectors, diffed
against silicon, exposed it.

I implemented the missing opcodes. The battery went to **47/47**.
CoreMark still validated.

## Pushing harder

A directed suite proves the cases you thought of. To attack the rest, I
added a randomized generator. A deterministic PRNG, seeded the same on
both sides. It produced 840 operand vectors across 21 instructions. Same
vectors, hardware and sim, diffed line by line. **840/840.**

Control flow got the same treatment. All 8 `brbs` and 8 `brbc` branches,
swept over the full 256-value `SREG`. Plus the `cpse`/`sbrc`/`sbrs`
skips. **448/448.** Every memory addressing mode also passed. Indirect,
post-increment, pre-decrement, displacement, direct, `lpm`,
`push`/`pop`. **4/4.**

Timing matched exactly. `nop`/`add`/`movw` cost 1 cycle.
`mul`/`ld`/`st`/`rjmp` cost 2. A `rcall`+`ret` round trip cost 7. Getting
this clean took care. I padded test-name strings to equal length. That
cancels the print cost in the cycle subtraction. I also paired each
`rjmp` with a skipped `nop`. A `rjmp .+2` chain jumps over every other
instruction.

Finally the CRC-32 workload. The checksum matched exactly (`bd5d2e01`).
The cycle count was hardware 29,836 versus sim 29,854. That is
**99.94%**. The 0.06% gap is a baseline-subtraction artifact, not a model
error.

## What I take from it

Sim-versus-sim agreement is comfortable and nearly worthless. Silicon as
the oracle is what makes a result mean something. And validation belongs
at the instruction and flag level. That is where the bugs are. A model
can pass every benchmark you own. It can still have a whole instruction
class wired to a stub. You only find that by asking real hardware.
