"""
title: Mare Liberum
author: Mare Liberum (ownerless, open source)
author_url: https://mareliberum.dev
version: 0.1.0
license: MIT
description: Briefs (what a task left out, the method, the quality bar, the checks), review of drafts, the works commons and the Atlas of websites — free, no key.
"""
import json
import urllib.parse
import urllib.request

BASE = "https://mareliberum.dev"


def _call(path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method="POST" if data else "GET", headers={"content-type": "application/json", "accept": "application/json", "user-agent": "openwebui-mare-liberum/0.1"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


class Tools:
    def __init__(self):
        pass

    def brief(self, task: str) -> str:
        """
        Get the brief for a task before starting it: what the request left out (with defaults), the method, the quality bar, the checks and a complete prompt.
        :param task: The task in words, as the user said it.
        """
        return _call("/brief.json?q=" + urllib.parse.quote(task))

    def review(self, task: str, draft: str) -> str:
        """
        Check a draft before handing it over: placeholders, stock phrases, arithmetic, dead links, length, missing parts.
        :param task: The task the draft answers.
        :param draft: The draft text.
        """
        return _call("/review", {"task": task, "draft": draft})

    def site(self, domain: str) -> str:
        """
        How an agent can use a website: its search link, sections, feeds, docs and robots.txt rules.
        :param domain: A domain such as example.org.
        """
        return _call("/site/" + urllib.parse.quote(domain) + ".json")
