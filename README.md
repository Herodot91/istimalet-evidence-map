# Harta dovezilor — istimâlet pe teren
### A digital evidence map of Ottoman governance at Kili and Akkerman, 1450–1600

Interactive prototype accompanying **Plamadeala, C. (2026)**, *Modelling istimâlet:
a relational historical evidence framework for Kili and Akkerman under Bayezid II*, v2
(Institute of History, Moldova State University).

**[Open the map](https://herodot91.github.io/istimalet-evidence-map/)** · bilingual RO / EN

---

## What it shows

The map models **the evidence for** istimâlet — not istimâlet itself, and not its effect.
That distinction is the point of the thing.

- **Each port is a fortress tower** of eight courses, one per governance dimension, always
  in the same order from the base up. Course width = how solid the *local* evidence is.
  The base is built; the top is not.
- **Annexed ground rises as a rampart**; tributary ground is hatched. Two instruments on
  one frontier — and the choice between them is the policy.
- **A tally names every source and its kind**: ◆ a period document, ● a modern study.
  At Chilia not one of the five sources is a period document.

## The findings it is built to make visible

| | |
|---|---|
| Dimensions with local evidence at Cetatea Albă | 4 of 8 |
| Conciliatory dimensions with support | 1 of 5 |
| Rows corroborated by two independent sources | **0** |
| Annexed territories carrying istimâlet coding, by 1595 | 1 of 4 |
| Reversals of annexation, 1450–1600 | **0** (tribute: 3 status changes) |

## Running it

One self-contained HTML file. No build step, no dependencies, no network calls —
open `index.html` in a browser. The 3D map is a hand-written perspective projector on
`<canvas>`; there is no charting or 3D library.

## Files

| | |
|---|---|
| `index.html` | the application |
| `SURSE-NOI.md` | what three recent sources changed, and what remains unverified |
| `validate-story.js` | checks a narrative record before it enters the map |
| `validate-entity.js` | checks an entity record against the control history |

## Licence and attribution

Code: MIT. **The istimâlet coding and the evidence model are the author's own research**
and are reproduced here with his authorship; cite v2, not this repository.

Territory polygons are schematic, not surveyed. No route in the dataset is attested —
endpoints are dated, the lines between them are inference.
