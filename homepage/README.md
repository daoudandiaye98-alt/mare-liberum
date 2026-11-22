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

## The paintings on this page

The page of the node opens on an oil painting of the same cut through the sea the page is (`site/film/home`: a ship at
the horizon, the sun, light going down into the water; the first painting all the others were made from). Its box is
set in CSS so that the painting's water surface (38.5 % of its height) lies on the waterline of the page, wherever that
is at any width (`--deep`, the water below the waterline, is named once on `.stage` for this); the name is cut where
the painted sea begins. While it is there (`.stage.painted`) the stated far water and sun step aside. Scrolling down to
the waterline moves the painting through its short film of 41 stills. Each zone carries the painting of its place at
its top (`<!--@ART:scene-->` in `page.html`): it comes out of the water when it is reached, and the films move as they
pass through the screen. The painting itself is `paint` from `src/scenes.js` (the look of the pages below), loaded from
the node after the page has opened, so every place of the sea is painted the same way. The build writes the paintings
only into the page of the node (`site/index.html`); the preview, with no node behind it, does without them. Without
the script, with motion not wanted, or where the reader saves data, the paintings simply stand.

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
| `../site/film/` | the painted scenes: for each of the 22 scenes one oil painting (`p.webp`, 716 px wide), and for the 15 that belong to a told place the same painting as a short film of 41 stills (`f00.webp` … `f40.webp`, 540 px wide); `index.json` names them, how many stills each has, and where each painting is looked at when only a band of it shows |
| `../node/skin.mjs` | the chart of places (which door lies at which depth, which scene it shows, the lines a told place says) and the dressing itself |
| `../node/skin-assets.mjs` | the three files above as the node answers them (`/depth.css`, `/depth.js`, `/depth-scenes.js`); written by the build, never by hand |

`node homepage/build.mjs` says whether `node/skin-assets.mjs` is what the sources give; `--write` writes it. A place
that is told (Atlantis, the harbour, the shipyard …) follows the reader's scroll through three lines; any other page
tells its scene itself, once, as the reader arrives. With motion not wanted, every scene stands as its last picture and
nothing is held back; without the script the page is complete and only the scene is missing.

Where the node carries the paintings (`public/film`, laid there from `site/film` by `tools/lay.mjs`), the scene at the
top of a page is painted: an old-master seascape of the place, in one style throughout (all were made from one first
painting, a cut through the sea with a ship above and the sunken city below). The painting comes out of the water in
squares that grow finer and goes back into it the same way as the page below arrives. At a told place it is a film: the
reader's scroll moves through its 41 stills, one at a time and never blended, while the three lines are said; the stills
are fetched after the page stands, the far-apart ones first, and a small ring says how far that is. Any other page shows
its painting still, settling slowly toward the reader. The painting is an ordinary image in the page: without scripts,
with motion not wanted, or where the reader saves data, it simply stands there. A node without paintings (the one to
take home does not carry them) shows the drawn scenes; so does a page whose painting fails to arrive.

The paintings were made once with an image model and a video model and are kept in the repository as they are served;
nothing is generated when a page is read. To change one, replace its files under `site/film/<scene>/` and the count in
`index.json` (its `v` goes into the address of every file, so change it too).

Behind every one of these pages lies the sea itself (`mountSea` in `src/scenes.js`): far off the water and its light,
computed for every point by a small shader (the surface seen from below near the top of a shallow page, shafts and a
net of light, clouds of living light in the deep, the seabed in perspective where a deep page ends), nearer what drifts
in it at many distances, each passing at the speed of its distance, so that scrolling is diving. Motion says what is
expected of the reader: a heading and the lines of a told place arrive word by word (read this now), text comes into
the light as it rises to where the eye reads, a school crosses along a heading that has just come into view, a field
pulses once when its form is reached (your turn), a pill says "Scroll" at the top and then how deep the reader is, and
the last thing on every page is the way on to the next place (`wayOn` in `node/skin.mjs`).

The sea starts quiet and grows richer while the machine keeps up; a machine without a graphics chip at work keeps the
still water of the stylesheet and loses nothing it needs. `?sea=full` on any page shows the whole sea whatever the
machine (for looking at it in a headless browser).

    node qa/depth.mjs --base=http://127.0.0.1:8787    every kind of page at four widths against a running node

It checks that each page is dressed, stays inside its screen, runs its scene (shows its painting), carries the foot and nothing of the old
look, and raises no error (`--engine=webkit|firefox`, `--calm`, `--nojs`, `--doors=/atlantis,/yard`).

## Fonts

Public Sans sets everything a visitor or an agent may bring and is the whole Latin file. Anybody (headings, the big
numbers; weights 800 to 900, every width) and EB Garamond Italic (the voice lines; weights 400 to 600) are cut to
Basic Latin, German and the common accented letters. A heading that needs another letter needs `tools/fonts.py` first.
The licence and what was changed stand in `site/fonts/OFL.txt`.
