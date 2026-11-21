#!/bin/sh
# The whole battery, compact. Run from homepage/ after `node build.mjs`:
#   sh qa/all.sh [out-dir]
# L is a node that serves the page with data behind it (a local `node serve.mjs`, or the sea itself), P the preview
# build. WebKit and Firefox are Playwright's own builds (npx playwright install webkit firefox); CHROME names the Chrome.
cd "$(dirname "$0")/.."
L=${L:-http://localhost:8788/}; P=${P:-file://$(pwd)/dist/preview/index.html}; O=${1:-qa/out}
mkdir -p "$O"
pj() { python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception as e: print('  (no JSON)', e); sys.exit()
$1"; }
echo "## probe (overflow, small text, touch targets)"
for vp in 320x568 360x800 390x844 768x1024 1024x768 1440x900 1920x1080; do node qa/probe.mjs --url=$L --vp=$vp 2>&1 | pj "print(' ', d['vp'],'sw',d['sw'],'cw',d['cw'],'overflow',[o for o in d['overflow'] if 'a.skip' not in o],'small',d['small'],'targets',d['targets'],'errors',d['errors'])"; done
for vp in 390x844 1440x900; do node qa/probe.mjs --url=$P --vp=$vp 2>&1 | pj "print('  preview', d['vp'],'sw',d['sw'],'cw',d['cw'],'overflow',[o for o in d['overflow'] if 'a.skip' not in o],'small',d['small'],'targets',d['targets'],'errors',d['errors'])"; done
echo "## act (menu, routing, tools, keyboard)"
node qa/act.mjs --url=$P --vp=390x844 --out=$O/act-m 2>&1 | pj "print('  preview 390:', {k:d[k] for k in ['planOpen','planClosedAfterLink','routedToCheck','headerBackOnScrollUp','planClosedOnEscape','checkScore','brainPaths','copyAnswer','errors']}, 'tab stops', len(d['tab']))"
node qa/act.mjs --url=$L --vp=1440x900 --out=$O/act-d 2>&1 | pj "print('  node 1440:', {k:d[k] for k in ['planOpen','planClosedAfterLink','routedToCheck','headerBackOnScrollUp','planClosedOnEscape','copyAnswer','errors']}, 'tab stops', len(d['tab']))"
echo "## contrast (measured from pixels; --wait keeps the measurement off the transitions)"
node qa/contrast.mjs --url=$L --vp=390x844 --wait=1900 2>&1 | pj "print('  node 390:', d['textRectsMeasured'],'rects, fails',d['fails'],'| lowest',d['lowest'][0][:70])"
node qa/contrast.mjs --url=$P --vp=1440x900 --wait=1900 2>&1 | pj "print('  preview 1440:', d['textRectsMeasured'],'rects, fails',d['fails'],'| lowest',d['lowest'][0][:70])"
echo "## frame (the preview in a sandboxed frame under a strict policy, as an artifact host shows it)"
node qa/frame.mjs --vp=390x844 --out=$O/frame --tag=fr 2>&1 | pj "print('  ', {'cls':d['env']['cls'],'fonts':d['env']['fonts'],'menu':d['menu'],'route':d['route']['hash'],'check':d['check']['score'],'ask':d['ask']['paths'],'end':d['end']['depth'],'blocked':d['blocked'],'errors':[e for e in d['errors'] if '404' not in e and 'Clipboard' not in e]})"
echo "## axe"
node qa/axe.mjs --url=$L --vp=390x844 2>&1 | grep -E "^---|VIOLATION" | sed 's/^/  390 /'
node qa/axe.mjs --url=$P --vp=1440x900 2>&1 | grep -E "^---|VIOLATION" | sed 's/^/  1440 /'
echo "## engines (WebKit with the shader, Firefox)"
node qa/engines.mjs --url=$L --out=$O/eng 2>&1 | pj "
for r in d: print('  ', {k:r.get(k) for k in ['engine','vp','cls','sw','cw','menuOpen','routed','check','failed','errors','launch'] if r.get(k) is not None})"
echo "## the lockup (both lines of the name as wide as each other, in three engines at five widths)"
node qa/fitcheck.mjs $L 2>&1 | sed 's/^/  /'
echo "## routing (the menu takes the reader to a section, with and without the shader)"
node qa/route.mjs --url=$L --engines=chromium,firefox,webkit 2>&1 | cut -c1-200 | sed 's/^/  /'
echo "## soft (no test hook: the page decides by itself what to draw the sea with)"
node qa/soft.mjs --url=$L --vp=390x844 --out=$O/soft --tag=m 2>&1 | pj "print('  390:', {k:d[k] for k in ['cls','seaVisible','sun','long','longMs','theme','themeEnd','rootEnd','errors']})"
node qa/soft.mjs --url=$L --vp=1440x900 --out=$O/soft --tag=d 2>&1 | pj "print('  1440:', {k:d[k] for k in ['cls','seaVisible','sun','long','longMs','theme','themeEnd','rootEnd','errors']})"
node qa/soft.mjs --url=$L --vp=390x844 --out=$O/soft --tag=m-nojs --nojs=1 --wait=2000 2>&1 | pj "print('  no JS:', d)"
node qa/soft.mjs --url=$L --vp=390x844 --out=$O/soft --tag=m-still --reduce=1 2>&1 | pj "print('  reduced motion:', {k:d[k] for k in ['cls','long','longMs','errors']})"
echo "## the governor (shader forced onto a slow renderer: it steps down and hands over to the CSS sea)"
node qa/govern.mjs --url=$L --vp=1440x900 --n=5 --scroll=1 2>&1 | sed 's/^/  /'
echo "## live (the node's own page with its data and tools)"
node qa/live.mjs --url=$L --tag=node --tools=1 --out=$O/live 2>&1 | tail -c 900 | tr '\n' ' '; echo
echo "## overflow without JavaScript and without web fonts"
for vp in 320x568 390x844 1440x900; do node qa/ovf.mjs --url=$L --vp=$vp --nojs=1 --nofonts=1 2>&1 | tail -c 300 | tr '\n' ' '; echo; done
node qa/ovf.mjs --url=$L --vp=390x844 --nofonts=1 2>&1 | tail -c 300 | tr '\n' ' '; echo
