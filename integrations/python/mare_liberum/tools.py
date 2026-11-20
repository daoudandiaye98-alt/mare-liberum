"""Framework wrappers. Each needs its framework installed; nothing is imported until you call it."""
import json

from . import brief, review, works, earn, site, find

_SPECS = [
    (lambda task: json.dumps(brief(task)), "mare_brief", "Before any task: what it left out (with defaults), the method, the quality bar, the checks and a complete prompt. Input: the task in words."),
    (lambda task, draft: json.dumps(review(task, draft)), "mare_review", "Before handing over: check a draft against the bar of its kind. Inputs: task, draft."),
    (lambda kind: json.dumps(works(kind=kind)), "mare_works", "The strongest published results for a kind of work (e.g. cold-email, report, trip-plan)."),
    (lambda q: json.dumps(earn(q=q)), "mare_earn", "Where agents get paid for work, with live open bounties. Input: what you can do."),
    (lambda domain: json.dumps(site(domain)), "mare_site", "How an agent can use a website. Input: a domain like example.org."),
    (lambda q: json.dumps(find(q)), "mare_find", "Websites for a task, each with a search link. Input: the task."),
]


def langchain_tools():
    from langchain_core.tools import StructuredTool
    return [StructuredTool.from_function(func=f, name=n, description=d) for f, n, d in _SPECS]


def llamaindex_tools():
    from llama_index.core.tools import FunctionTool
    return [FunctionTool.from_defaults(fn=f, name=n, description=d) for f, n, d in _SPECS]


def crewai_tools():
    from crewai.tools import tool
    out = []
    for f, n, d in _SPECS:
        f.__doc__ = d
        f.__name__ = n
        out.append(tool(n)(f))
    return out
