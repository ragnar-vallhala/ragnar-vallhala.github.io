---
title: "Multiplying, Not Surrendering"
date: 2026-06-17
description: "A developer's case for AI as a tool — not a pariah to fear, not a witch's pot to worship. It multiplies your judgment instead of replacing it, as long as you stay the one steering."
tags: [ai, tools, craft, programming]
draft: true
---

AI didn't just bring inflated stocks and a bubbled economy. It has brought real changes in behaviour. I think it is still too early to judge what this technology means for human society — and I won't pretend I can predict it. Leave that to the people who do it professionally.

But as a developer, I have watched a lot change between when I started learning to code and what people do now.

## Three camps

The reactions sort themselves into three groups.

Some are strict about never using AI, at any cost. They treat it as a pariah that will somehow rot their ability to think the moment they touch it. Others are all in — a new wave that arrived under the name *vibe coders*. The two seem to be at a crossroads in every public forum you visit.

Then there is the third group, the majority in any dividing matter: the people who can't decide which side to take until someone tells them to. If a famous personality says it's good, it's good; if not, not. A large part of the Linux community was firmly against generated code in the kernel — until Linus said it was fine to use it as a tool, and suddenly the same people were fine with it too. Not all of them, of course. Dissent is a thing.

## What it changed for me

I have used AI since GPT-3 shipped and I could get my hands on it. Through college assignments and personal projects, I leaned on it widely.

Writing embedded code, it was not good at first. I had to hand-roll almost everything and use it only to review my code, file by file. But I had no other reviewer. AI helped a lot. I could sit down and argue about my own choices over a piece of abstract, cryptic writing — with a machine — and that was genuinely great.

Debugging over gdb with OpenOCD was never a feeling I enjoyed. The tools are good, and learning them gets you out of wedged situations, but staring at a plain, colourless terminal for hours to find the one wrong register value among hundreds of addresses is not pleasant. The current generation of tools — especially agents that can automate the debugging and reviewing — is a real gift, at least for me. Not because I couldn't find that pesky race condition on a debugger myself, but because it would take hours, if not days, that I now get back in minutes.

## Multiplying, not surrendering

So aren't we surrendering our decision-making to a tool?

Here is where I differ from most of what I hear. It is not about switching off your cerebral faculty. It is about multiplying it. If you can spin up three agents and take on three problems at once, what stops you there? We can stay ahead of all of it, all the time — if we treat these things as tools rather than an all-encompassing power house.

Steer the ship of flowing tokens in the right direction. Don't be a Jack clinging to a log.

## Where the failure is the point

Sometimes we want to learn something new — something that excites us, or that we care about for its own sake. That is a different game.

There, doing the task quickly is not the goal. The process of failing, and reaching the right answer *through* those failures, is how you learn where the pitfalls are. Writing a CUDA kernel for the first time, from a guide, forces you to think about every angle bracket — the ones that would otherwise be filled in correctly for you, unseen. Those gruelling sessions aren't only for people who go looking for trouble in an age when they could get it right on the first try. They are for anyone who wants to build something meaningful and deep.

Nothing made is perfect — except, maybe, the axiomatic mathematics my professors tried hard to impart to me. Tools like AI, probabilistic by nature, tend to be *more* imperfect than rigorously proven ones, especially where there is human error or an invalid assumption underneath. That is exactly why we have to take the lead and steer, not cling.

## How I actually use it

When I use AI to generate code, I never start from code generation.

I start with the framework — planning it back and forth, setting it up so the generated code can be *falsified*. I believe, and others may disagree, that any code which isn't fallible is false by default. Once the framework is ready and the due diligence is done, the coding starts. Most of my focus then goes to the test cases — the safety net for code produced at a rate no human can verify by hand. I try to ensure as much coverage as possible.

This has scaled well for me. I don't generate as much code as someone writing backend or frontend logic full of boilerplate, but what I work on demands the utmost correctness.

## In the end

I don't think AI is something to be hesitant about — unless you are doing something truly precious to you. (Andrew Kelley, the founder of Zig, has a different situation, and there I find the caution justified.) Nor is it something to over-indulge in, until it feels like magic rising out of a witch's pot.

Still, people do things their way. I have seen many trading prompts to get results. No one can stop them.
