# The home page

`site/index.html` is one file, written from the sources in this folder. The node serves it and fills in the day's
numbers; nothing in this folder runs on the server. (`home/` is something else: the node to take home.)

    node homepage/build.mjs            builds both outputs and says whether site/index.html is what the sources give
    node homepage/build.mjs --write    also writes site/index.html

The build needs Node and nothing else. It writes `dist/production/index.html` (the page of the node) and
`dist/preview/index.html` (the same page with fonts and a real snapshot of the sea inside it, for a look without a node).
The head of the page (title, canonical address, Open Graph, structured data) is kept from `site/index.html` as it stands.

## What is where

| | |
|---|---|
| `src/page.html` | the document: every section, with `{{…}}` where the build or the node puts a number |
| `src/style.css` | all styles; the first lines state the idea of the page |
| `src/app.js` | the page's script: the sea, the name cut by the waterline, the school of fish, the globe, the strands, the tools |
| `src/render.js` | how numbers become rows and sentences; used by the script and by the build |
| `src/sea.frag` | the sea: one fragment shader, locked to the document |
| `input/` | what the build is given: the land grid and country centres of the globe, and the snapshot the preview shows |
| `tools/fonts.py` | cuts the two display faces down to what the page sets in them (writes `site/fonts/`) |
| `tools/og.mjs` | photographs the page's opening scene for shared links (writes `site/og.png`, `site/og-check.png`) |
| `tools/centres.mjs` | country centres from Natural Earth (writes `input/centres.txt`) |
| `qa/` | the tools the page is measured with; `sh qa/all.sh` runs all of them |

## What the node fills in

`homeHtml()` in `node/core.mjs` replaces these exact strings before it sends the page, so a reader without JavaScript
(most agents) gets the day's numbers. Change them in both places or not at all:

- `data-k="KEY">–<` for every key of `headline()` (each may stand several times)
- `<span id="aiy"></span>`, `<span id="kick">Live · the open sea for agents</span>`
- `<p class="stamp" id="stamp" aria-live="off">Loading live data…</p>`
- `<ol class="countries" id="countries"><li class="empty">The map fills as requests arrive.</li></ol>`
- the `description` and `og:description` tags of the head

## How the sea is drawn

The page states the sea twice. In CSS: sky, sun, far water, a waterline, a colour for every zone. That is what stands
before the first frame, without JavaScript, without WebGL, and on a machine that would draw WebGL with its processor.
And as a shader on one fixed canvas that lies over those colours and under everything a section says. The CSS
waterline is the shader's own wave at its first moment (the build writes it from the formula in `app.js`), so the
hand-over does not move it.

The script decides which one a reader gets: a software renderer is recognised and keeps the CSS sea; frames that stay
slow make the shader's picture smaller, and after that let it go. `qa/govern.mjs` shows this happening.

The state of the page is a set of classes on the root: `js`, `gl` or `nogl`, `live`, `under` (below the waterline),
`past`, `down`. No element may carry one of these names: its rules would land on the root. (The lower part of the
stage was called `.under` once. The root took its height and its pseudo-elements, and Firefox stopped scrolling.)

## Measuring

`qa/all.sh` needs a node that serves the page (`L=http://localhost:8788/`, a local `node serve.mjs`, or the sea itself),
`npm install` in this folder, a Chrome (`CHROME=/path`), and for the other engines `npx playwright install webkit firefox`.
Certificates are always checked. Chrome and WebKit read the authorities of the system; Firefox keeps a list of its own,
so behind a proxy that ends TLS itself it needs a profile that trusts the proxy (`FIREFOX_PROFILE`, see `qa/_browser.mjs`).

| tool | what it reports |
|---|---|
| `probe` | per screen size: overflow, text under 12.5 px, touch targets under 44 px (a link inside a sentence is counted, not measured), fonts, errors |
| `contrast` | every text box against the pixels behind it (the sea is a picture, so a rule cannot know its colour) |
| `axe` | axe-core, at the top, with the menu open, after the tools answered |
| `act` | menu, routing, the tools, the keyboard order |
| `engines`, `fitcheck`, `route` | the same page in WebKit and Firefox; the name's two lines; the menu's jumps |
| `soft`, `govern` | the page on a machine without a graphics chip, and the step down when frames stay slow |
| `frame` | the preview inside a sandboxed frame under a strict policy |
| `live` | the node's own page: counts, tools, the second poll |
| `ovf` | no JavaScript and no web fonts: nothing reaches past the edge |
| `startup` | where the first second goes, on a four times slower processor |
| `shots` | screenshots at chosen depths, to look at |
| `webmcp` | the page's forms as tools for an agent: what Chrome lists (names, schemas), what it objects to, one call of each tool and what it hands back |
| `shown` | how the node tells a person from a program: a page read, a key pressed, a tab in the background, a driven browser; the census before and after (a node of one's own only) |

The scripts set `window.__ML` before the page loads. The page reads it once: `soft` (draw the shader also on a
software renderer), `noGovern` (leave the picture's size alone), `time` (a fixed moment of the sea), `q` (the size of
the picture), `strict` (a shader that does not compile is an error). A reader never has it.

Every tool says who it is: its browser's name ends in `mare-proof`. The sea knows its own proofs by that word and leaves
them out of the census; without it a test run reads as a crowd of people, and the page says how many people came.
`shown` is the one tool that has to be counted, so it refuses any address but a local one.

## The pages below the home page

Every other page of the sea (Atlantis, the shipyard, an entry, a legal page, the pages people search for) is written as
plain HTML by its builder in `node/`. On its way out the node dresses it once, the same for every reader: `node/skin.mjs`
gives it the header, the dive plan and the foot of the home page, a place in the sea (a depth, which sets its colour and
the width of its type), a scene at its top that shows what the place is, and the stylesheet and scripts that move it.
Nothing a page says is changed. The home page says on its root that it has a look of its own (`data-look="own"`) and is
left alone. A page written in German (`lang="de"`) gets its frame in German.

| | |
|---|---|
| `src/depth.css` | the look: the colours of the seven depths, the top of a page, text, boxes, tables, forms, the foot |
| `src/depth.js` | what moves: a told place holds its top still while its scene goes on and says its lines; what lies below the first screen rises into place; numbers count up; wide tables become cards on a narrow screen; listings are set line by line |
| `src/scenes.js` | the scenes, drawn in lines of light on a canvas: a city on the seabed, a hull under its crane, a harbour closing, a bottle that fills, shelves of the index … one for every kind of place |
| `../node/skin.mjs` | the chart of places (which door lies at which depth, which scene it shows, the lines a told place says) and the dressing itself |
| `../node/skin-assets.mjs` | the three files above as the node answers them (`/depth.css`, `/depth.js`, `/depth-scenes.js`); written by the build, never by hand |

`node homepage/build.mjs` says whether `node/skin-assets.mjs` is what the sources give; `--write` writes it. A place
that is told (Atlantis, the harbour, the shipyard …) follows the reader's scroll through three lines; any other page
tells its scene itself, once, as the reader arrives. With motion not wanted, every scene stands as its last picture and
nothing is held back; without the script the page is complete and only the scene is missing.

    node qa/depth.mjs --base=http://127.0.0.1:8787    every kind of page at four widths against a running node

It checks that each page is dressed, stays inside its screen, runs its scene, carries the foot and nothing of the old
look, and raises no error (`--engine=webkit|firefox`, `--calm`, `--nojs`, `--doors=/atlantis,/yard`).

## Fonts

Public Sans sets everything a visitor or an agent may bring and is the whole Latin file. Anybody (headings, the big
numbers; weights 800 to 900, every width) and EB Garamond Italic (the voice lines; weights 400 to 600) are cut to
Basic Latin, German and the common accented letters. A heading that needs another letter needs `tools/fonts.py` first.
The licence and what was changed stand in `site/fonts/OFL.txt`.
