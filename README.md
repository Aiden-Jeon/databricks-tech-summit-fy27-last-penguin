# Workshop - Nimbus (Conversion Slide & Feature Velocity)

Databricks project: `databricks-tech-summit-fy27-last-penguin`

**The use case, in plain words:** Nimbus is a mobile-first marketplace with 15M monthly users. A recent checkout-flow change **hurt some user groups and not others** — conversion is sliding for Gen-Z on Android while iOS is fine, and every week the team takes to spot it and ship a fix is lost revenue. You build an app that spots each sliding user segment, explains **why**, recommends the feature to ship next — **a variant that already won for a similar group, an alternative, or an existing flag that helped a neighboring group** — and lets a PM approve it, writing the decision back to the product to read at low latency. The data, the recommendation, and the AI that assists are all governed on Databricks, scale-to-zero when idle, with AI spend capped against margin.

## 🎓 Start here — you build this, it isn't pre-built

Starting point for the Tech Summit FY27 Live Days **AI Customer Challenge**. It ships the **data
generator + specs + a bootstrap app** — **you build the solution** (that's the exercise). Build like
a citizen developer: **describe your intent to Genie Code and iterate**. Work carries forward
step by step.

### ▶️ How to start

**1. Get the template into your workspace.** Download it from **go/solution-builder** and import the folder into your Databricks workspace (Workspace → *Import*). Everything you need travels with it — work directly from there.

**2. Open a Genie Code session** in that folder and kick it off with this prompt:

> *"Read `README.md`, then all the files under `specifications/`, to build up the full context of
> this workshop — the story, the data model, and each component I need to create. Then read
> `data_generation/generate_data.py` to understand how the raw data is structured. Before doing
> anything, ask me which **catalog and schema** to use. Then run `data_generation/generate_data.py`
> as a **job run** into that catalog/schema to load the raw data. Put all the files you create in
> this project folder — transformation code under `./transformation`, and the dashboard, Genie
> space, and everything else at the root (`./`)."*

From there, build the solution one component at a time — SDP pipeline, dashboard, Genie, Lakebase, app, gateway.

**3. Build the solution**, iterating with Genie Code, using the per-component detail in `specifications/`. For the app, point your agent at `app/APP_WORKSHOP.md`.

Everything below is the **story + reference spec** the build should realize. The `specifications/`
folder has the full detail per component; `resources.json` lists the capabilities.

---

## The Story

| | |
|---|---|
| **Company** | Nimbus — a mobile-first marketplace + streaming app (~15M MAU, ~$400M revenue, ~400-person lean team) |
| **Hero** | Jordan Cole, VP Growth (non-technical) |
| **Problem** | A checkout-flow change landed unevenly across platforms — conversion is sliding for a cluster of Android/Gen-Z cohorts while iOS holds |
| **Investigation** | Jordan asks *"Conversion is sliding in this segment — which feature should ship next?"* — the platform ranks ship-a-proven-variant vs. roll-out-a-flag vs. ship-an-alternative |
| **Root cause** | Event data is analytical, not served to the product, so the cycle to spot the slide → decide the feature → ship it is slow |
| **Impact** | ~$10M annualized conversion-at-risk across ~40 sliding cohorts, conversion gap ~4% (healthy) vs ~2.8% (sliding) — concentrated on Android/Gen-Z after the checkout change |

---

## Overview

Jordan Cole (VP Growth) opens the growth console and sees a red cluster on one chart: large user cohorts whose conversion slid after a checkout-flow change landed badly on Android. Jordan asks about the worst — *"conversion is sliding for SEG-0000214, which feature should ship next?"* — and the app surfaces the driver (the checkout change hurt this segment), ranks **ship a proven variant / roll out an existing flag / ship an alternative** by projected conversion lift, recommends the proven variant (a past experiment lifted a similar cohort), drafts the rollout note, and writes the flag decision back to Lakebase for the product to read at low latency after Jordan approves. Governed cohort data, a governed recommendation, and a governed AI assistant — scale-to-zero when idle, with AI spend capped against margin.

---

## Key Numbers

| Metric | Value |
|--------|-------|
| MAU | ~15M (sampled as ~500 cohort×platform segments) |
| Cohorts | gen_z / millennial / gen_x / boomer × ios / android / web |
| Hero segment | SEG-0000214 — Gen-Z on Android, conversion slid 4.2% → 2.9%, a matching proven experiment exists |
| Checkout-change onset | ~3 weeks ago (dynamic — `CHANGE_ONSET = NOW − 3 weeks`) |
| Sliding cohorts | ~40 (Android/web, conversion dropped) |
| Conversion gap | healthy ~4% vs sliding ~2.8% |
| Conversion at risk | ~$10M annualized (~$4M/yr per 1pt of overall conversion — talking-track) |
| Feature action ranked by model | ship a proven variant / roll out an existing flag / ship an alternative + predicted conversion lift |
| Assistant AI spend | Capped against margin; the served decision (feature flag) is scale-to-zero for near-zero idle cost |

---

## The demo arc (what the finished solution shows)

1. **See it** — open the Growth Desk app: a conversion×MAU scatter, a red cluster of large sliding cohorts, with conversion-at-risk + sliding-count KPIs.
2. **Ask why** — in the chat dock, ask why SEG-0000214 is sliding; the assistant investigates via Genie + the experiment history over the governed lakehouse.
3. **Get the feature** — the assistant ranks ship-proven / roll-out-flag / ship-alt by projected conversion lift and recommends the proven variant, with a what-if + a drafted rollout note.
4. **Act** — approve → the feature-flag decision writes back to Lakebase for the product to read at low latency → the queue and KPIs update live.
5. **Governed AI** — every assistant call runs through Unity AI Gateway (spend cap against margin, guardrails, logging), scale-to-zero when idle.

Full per-component detail is in `specifications/`.
