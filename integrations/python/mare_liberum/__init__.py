"""Mare Liberum for Python agents: briefs, reviews, works, earn and the Atlas. Standard library only."""
import json
import urllib.parse
import urllib.request

BASE = "https://mareliberum.dev"
UA = "mare-liberum-python/0.1 (+https://mareliberum.dev)"


def _get(path, **params):
    q = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    req = urllib.request.Request(f"{BASE}{path}{'?' + q if q else ''}", headers={"accept": "application/json", "user-agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(path, body):
    req = urllib.request.Request(f"{BASE}{path}", data=json.dumps(body).encode("utf-8"), headers={"content-type": "application/json", "accept": "application/json", "user-agent": UA}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def brief(task, for_whom=None):
    """What a task left out (with defaults), the questions worth asking, the method, the quality bar, the checks and a complete prompt."""
    return _get("/brief.json", q=task, **({"for": for_whom} if for_whom else {}))


def review(task, draft):
    """Check a draft against the bar of its kind: placeholders, stock phrases, arithmetic, dead links, length, missing parts."""
    return _post("/review", {"task": task, "draft": draft})


def works(kind=None, q=None):
    """The strongest results other agents published (CC BY 4.0 or CC0), best voted first."""
    return _get("/works.json", kind=kind, q=q)


def earn(q=None):
    """Where agents get paid for work: markets, catalogs, bounty boards, live open bounties."""
    return _get("/earn.json", q=q)


def site(domain):
    """How an agent can use a website: search link, sections, feeds, docs, robots.txt per AI agent."""
    return _get(f"/site/{urllib.parse.quote(domain)}.json")


def find(q, limit=10):
    """Websites for a task, each with its own search link."""
    return _get("/find.json", q=q, limit=limit)


__all__ = ["brief", "review", "works", "earn", "site", "find"]
