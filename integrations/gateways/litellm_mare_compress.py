"""
Mare Liberum /compress in a LiteLLM proxy: long tool results reach the model smaller, without loss.

What it does: before each call (async_pre_call_hook) it looks at the tool results in the request:
OpenAI chat messages with role "tool" (or "function"), Anthropic "tool_result" blocks and Responses
API "function_call_output" items. Each text of at least min_chars characters (default 2,000) goes to
POST https://mareliberum.dev/compress, which gives it back made smaller by lossless steps only (HTML
as Markdown, JSON minified or as TOON, whitespace, a line said twice said once). The answer replaces
the text only when it is smaller in UTF-8 bytes; in every other case the original stays.

What leaves your proxy: the text of those tool results and nothing else of the request (no prompt,
no key, no user). mareliberum.dev keeps none of it: nothing sent to /compress is stored or logged,
only its size is counted (https://mareliberum.dev/engine). Leave this callback out for tool results
you may not send to a third party.

Fails open: an error, a timeout (timeout seconds per text, default 4), a busy or resting /compress
(503), a pace limit (429) or an answer that is not smaller keeps the original text. The hook never
raises and never rejects a request. Answers are remembered in memory (256 texts, by SHA-256 of the
text), so a conversation sent again sends no text twice and keeps the same prefix for prompt caching.

Use: put this file beside config.yaml and add

    litellm_settings:
      callbacks: litellm_mare_compress.proxy_handler_instance

Settings, from the environment: MARE_COMPRESS_URL (default https://mareliberum.dev/compress),
MARE_COMPRESS_MIN_CHARS (2000), MARE_COMPRESS_TIMEOUT (4 seconds), MARE_COMPRESS_MAX_TEXTS (at most
8 texts sent per request). No packages beyond LiteLLM itself.
"""
import asyncio
import hashlib
import json
import os
import urllib.request
from collections import OrderedDict

from litellm.integrations.custom_logger import CustomLogger

URL = "https://mareliberum.dev/compress"
MAX_BYTES = 1024 * 1024  # the most /compress takes


def _bytes(s):
    return len(s.encode("utf-8"))


def _setting(value, env, default, cast):
    try:
        return cast(value if value is not None else os.environ.get(env, default))
    except (TypeError, ValueError):
        return default


class MareCompress(CustomLogger):
    def __init__(self, url=None, min_chars=None, timeout=None, max_texts=None, remember=256):
        super().__init__()
        self.url = url or os.environ.get("MARE_COMPRESS_URL") or URL
        self.min_chars = _setting(min_chars, "MARE_COMPRESS_MIN_CHARS", 2000, int)
        self.timeout = _setting(timeout, "MARE_COMPRESS_TIMEOUT", 4.0, float)
        self.max_texts = _setting(max_texts, "MARE_COMPRESS_MAX_TEXTS", 8, int)
        self._remember = remember
        self._memory = OrderedDict()

    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        try:
            await self.squeeze_request(data)
        except Exception:
            pass  # fail open: the request goes on as it came
        return data

    async def squeeze_request(self, data):
        """Every long tool result of a request through /compress; data is changed in place and returned."""
        left = self.max_texts
        for text, put in self._tool_texts(data):
            if len(text) < self.min_chars or _bytes(text) > MAX_BYTES:
                continue
            key = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if key in self._memory:
                self._memory.move_to_end(key)
                smaller = self._memory[key]
            elif left > 0:
                left -= 1
                try:
                    smaller = await asyncio.wait_for(asyncio.to_thread(self._post, text), self.timeout + 1)
                except Exception:
                    continue  # not remembered: the next request asks again
                self._memory[key] = smaller
                while len(self._memory) > self._remember:
                    self._memory.popitem(last=False)
            else:
                continue
            if smaller is not None:
                put(smaller)
        return data

    def _post(self, text):
        """The text /compress gave back when it is smaller and lossless, else None."""
        req = urllib.request.Request(
            self.url,
            data=json.dumps({"text": text}).encode("utf-8"),
            method="POST",
            headers={"content-type": "application/json", "accept": "application/json", "user-agent": "litellm-mare-compress/1.0"},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            if r.status != 200:
                return None
            answer = json.loads(r.read(4 * MAX_BYTES).decode("utf-8"))
        if not isinstance(answer, dict) or answer.get("lossy") is not False:
            return None
        out, saved = answer.get("out"), (answer.get("tokens") or {}).get("saved")
        if isinstance(out, str) and isinstance(saved, (int, float)) and saved > 0 and _bytes(out) < _bytes(text):
            return out
        return None

    @staticmethod
    def _tool_texts(data):
        """The tool results of a request as (text, put) pairs: put(new) writes a new text in its place."""
        found = []

        def take(holder, key):
            value = holder.get(key)
            if isinstance(value, str):
                found.append((value, lambda new, h=holder, k=key: h.__setitem__(k, new)))
            elif isinstance(value, list):
                for part in value:
                    if isinstance(part, dict) and part.get("type") in ("text", "input_text", "output_text") and isinstance(part.get("text"), str):
                        found.append((part["text"], lambda new, p=part: p.__setitem__("text", new)))

        for message in data.get("messages") or []:
            if not isinstance(message, dict):
                continue
            if message.get("role") in ("tool", "function"):
                take(message, "content")  # OpenAI chat
            elif isinstance(message.get("content"), list):
                for block in message["content"]:
                    if isinstance(block, dict) and block.get("type") == "tool_result":
                        take(block, "content")  # Anthropic messages
        items = data.get("input")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and item.get("type") == "function_call_output":
                    take(item, "output")  # Responses API
        return found


proxy_handler_instance = MareCompress()
