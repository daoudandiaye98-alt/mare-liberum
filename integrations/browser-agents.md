# Atlas paths for browser agents (browser-use, Stagehand, Playwright agents)

Before driving a browser through a site, ask the Atlas how the site works for agents. Often the click path is not needed.

```python
import json, urllib.request
site = json.load(urllib.request.urlopen("https://mareliberum.dev/site/example.org.json"))
template = (site.get("search") or {}).get("template")   # a one-link search, e.g. https://example.org/search?q={q}
agents = site.get("agents", [])                          # robots.txt per AI agent: [{"name": "ChatGPT-User", "allowed": true}, ...]
```

- If `template` exists, open it with `{q}` filled instead of typing into the page.
- Respect `agents`: where `allowed` is false for your agent, do not read the site.
- No map yet? The first call maps the site live (a few seconds).
- For the task itself, get the brief first: `https://mareliberum.dev/brief.json?q=<task>`.
