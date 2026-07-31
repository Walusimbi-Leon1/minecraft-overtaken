# Minecraft Overtaken

**A Missionary's Guide to Reclaiming the Blocky World**

*Fifteen missions. Three tiers of difficulty. One world to take back.*

The world of Minecraft has been overtaken — by shadow, by chaos, by the
creatures that own the dark. The Old Builders are gone. But they left one
thing behind: a map, a compass, and a commission. You are the missionary
of the block. Your task is not merely to survive. Your task is to take
the world back — one mission at a time.

This is not a story you read. It is a mission log you complete.

## Read the Book

The full book is published on GitHub Pages:

**https://walusimbi-leon1.github.io/minecraft-overtaken/**

The raw source is `book/part1.md` (~11,000 words).

## The Missions

| Tier | Missions | Difficulty | Theme |
|---|---|---|---|
| Tier I | 1–5 | Easy | Build your first home, farm, road, tower, and mine |
| Tier II | 6–10 | Normal | Carve an underground base, smelt iron, bridge a chasm, enter the Nether, master redstone |
| Tier III | 11–15 | Hard | Hunt the stronghold, slay the dragon, raid the ocean monument, build a sky city, raise the Beacon of Overtaking |

Every mission includes:

- **Mission Briefing** — what is happening in the world, and why it matters
- **Objective** — exactly what you must accomplish
- **Supplies** — the blocks and items you must gather, and how many
- **Coordinates** — exact X, Y, Z positions for every task (e.g. dig a
  1×2 shaft at (50, 63, −70) straight down to Y 16)
- **The Plan** — step-by-step execution
- **Success Checklist** — how you will know the mission is complete
- **Missionary Note** — a reflection from the field

## Reading the Coordinates

The three numbers are always in the same order: **X, Y, Z**.

- **X** — east (+) / west (−)
- **Y** — up / down (height) — your altitude; sea level is Y = 63
- **Z** — south (+) / north (−)

X or Z changes mean you are moving sideways; Y changes mean you are
moving up or down. To find any site in the book: match X and Z first,
then adjust Y.

## World Setup

- **World name:** Overtaken · **Seed:** `OVERTAKEN`
- **Game mode:** Survival · **Difficulty:** Normal (Easy if new, Hard if veteran)
- **World type:** Default · **Cheats:** Off

## Building the Site

The published page is generated from `book/part1.md`:

```bash
python3 build_site.py   # regenerates index.html
```

Requires the Python `markdown` package (`pip install markdown`).

## Release Assets

Each release ships a `.zip` of the book:

- `minecraft-overtaken-v1.0.zip` — the full book (`book/part1.md`),
  the published page (`index.html`), the README, and the build script.

---

*Written in the mission field, block by block.*
