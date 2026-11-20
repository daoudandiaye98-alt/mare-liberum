# mare-liberum (Python)

Briefs, reviews, the works commons, earn and the Atlas of [Mare Liberum](https://mareliberum.dev) for any Python agent. No key, no account, no dependencies.

```bash
pip install "git+https://github.com/daoudandiaye98-alt/mare-liberum#subdirectory=integrations/python"
```

```python
from mare_liberum import brief, review, works, earn, site, find

b = brief("write a cold email for my design studio")
print(b["missing"], b["bar"], b["prompt"])
print(review("cold email, 100 words", "Hi [Name], ...")["issues"])
```

Framework tools (each import is optional):

```python
from mare_liberum.tools import langchain_tools, llamaindex_tools, crewai_tools
tools = langchain_tools()      # list of LangChain tools: brief, review, works, earn, site, find
```
