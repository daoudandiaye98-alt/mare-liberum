"""
Tests of litellm_mare_compress without LiteLLM: a stand-in for its CustomLogger and a local stand-in
for /compress (http.server in a thread). With MARE_COMPRESS_LIVE_URL set (a node of Mare Liberum, e.g.
http://127.0.0.1:8787/compress) the last test sends real tool results to that node's /compress.

Run: python3 -I integrations/gateways/test_litellm_mare_compress.py   (exit code 1 when a test fails)
"""
import asyncio
import json
import os
import sys
import threading
import time
import types
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# LiteLLM is not installed here: its base class, under the name the callback imports it by
_custom_logger = types.ModuleType("litellm.integrations.custom_logger")


class CustomLogger:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


_custom_logger.CustomLogger = CustomLogger
sys.modules.update({"litellm": types.ModuleType("litellm"), "litellm.integrations": types.ModuleType("litellm.integrations"), "litellm.integrations.custom_logger": _custom_logger})

import litellm_mare_compress as M  # noqa: E402

LONG_HTML = "<html><body><main><h1>Prices</h1>" + "".join(f"<p class=\"row\">  Plan {i}:   {i * 3} EUR   a month  </p>\n" for i in range(120)) + "</main></body></html>"
LONG_JSON = json.dumps({"results": [{"id": i, "name": f"server {i}", "url": f"https://example.org/{i}/mcp"} for i in range(80)]}, indent=2)


class Stand(BaseHTTPRequestHandler):
    """/compress as the node answers it; the mode says how it fails."""
    mode = "ok"
    seen = []

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)) or b"{}")
        Stand.seen.append(body)
        text = body.get("text", "")
        if Stand.mode == "slow":
            time.sleep(2)
        if Stand.mode in ("busy", "error"):
            return self._send(503 if Stand.mode == "busy" else 500, {"error": {"code": "UNAVAILABLE", "message": "busy"}})
        if Stand.mode == "garbage":
            return self._raw(200, b"<html>not json</html>", "text/html")
        out = " ".join(text.split()) if Stand.mode in ("ok", "slow", "lossy") else text + " and more"
        before, after = len(text) // 4, len(out) // 4
        self._send(200, {"out": out, "form": "text", "tokens": {"before": before, "after": after, "saved": max(0, before - after)}, "steps": [], "lossy": Stand.mode == "lossy", "note": "nothing you sent is kept or logged"})

    def _send(self, status, obj):
        self._raw(status, json.dumps(obj).encode(), "application/json")

    def _raw(self, status, data, ctype):
        self.send_response(status)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def chat(tool_text, user_text="Summarise the prices."):
    return {"model": "any", "messages": [
        {"role": "system", "content": "You are careful."},
        {"role": "user", "content": user_text},
        {"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "read", "arguments": "{}"}}]},
        {"role": "tool", "tool_call_id": "c1", "content": tool_text},
    ]}


def hook(cb, data):
    return asyncio.run(cb.async_pre_call_hook(user_api_key_dict=None, cache=None, data=data, call_type="completion"))


class Callback(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Stand)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_address[1]}/compress"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        Stand.mode, Stand.seen = "ok", []
        self.cb = M.MareCompress(url=self.url, timeout=0.5)

    def test_a_custom_logger_with_an_instance_for_config_yaml(self):
        self.assertTrue(issubclass(M.MareCompress, CustomLogger))
        self.assertIsInstance(M.proxy_handler_instance, M.MareCompress)
        self.assertEqual(M.proxy_handler_instance.url, os.environ.get("MARE_COMPRESS_URL") or "https://mareliberum.dev/compress")

    def test_a_long_tool_result_comes_back_smaller_and_nothing_else_is_sent(self):
        data = chat(LONG_HTML)
        out = hook(self.cb, data)
        self.assertIs(out, data)
        self.assertEqual(out["messages"][3]["content"], " ".join(LONG_HTML.split()))
        self.assertEqual([m["content"] for m in out["messages"][:2]], ["You are careful.", "Summarise the prices."])
        self.assertEqual(Stand.seen, [{"text": LONG_HTML}], "only the tool result leaves the proxy")

    def test_short_tool_results_are_not_sent(self):
        data = chat("a short answer " * 10)
        hook(self.cb, data)
        self.assertEqual(Stand.seen, [])
        self.assertEqual(data["messages"][3]["content"], "a short answer " * 10)

    def test_content_parts_anthropic_tool_results_and_responses_items(self):
        data = {"messages": [
            {"role": "tool", "tool_call_id": "c1", "content": [{"type": "text", "text": LONG_HTML}, {"type": "image_url", "image_url": {"url": "x"}}]},
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t1", "content": LONG_JSON}, {"type": "text", "text": LONG_HTML}]},
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t2", "content": [{"type": "text", "text": LONG_JSON + " "}]}]},
        ], "input": [{"type": "function_call_output", "call_id": "f1", "output": LONG_HTML + " "}]}
        hook(self.cb, data)
        m = data["messages"]
        self.assertEqual(m[0]["content"][0]["text"], " ".join(LONG_HTML.split()))
        self.assertEqual(m[0]["content"][1], {"type": "image_url", "image_url": {"url": "x"}})
        self.assertEqual(m[1]["content"][0]["content"], " ".join(LONG_JSON.split()))
        self.assertEqual(m[1]["content"][1]["text"], LONG_HTML, "a user's own text is no tool result")
        self.assertEqual(m[2]["content"][0]["content"][0]["text"], " ".join(LONG_JSON.split()))
        self.assertEqual(data["input"][0]["output"], " ".join(LONG_HTML.split()))
        self.assertEqual(len(Stand.seen), 4)

    def test_an_answer_that_is_not_smaller_keeps_the_original(self):
        Stand.mode = "bigger"
        data = chat(LONG_HTML)
        hook(self.cb, data)
        self.assertEqual(data["messages"][3]["content"], LONG_HTML)

    def test_a_lossy_answer_keeps_the_original(self):
        Stand.mode = "lossy"
        data = chat(LONG_HTML)
        hook(self.cb, data)
        self.assertEqual(data["messages"][3]["content"], LONG_HTML)

    def test_errors_and_timeouts_fail_open(self):
        for mode in ("busy", "error", "garbage", "slow"):
            Stand.mode = mode
            cb = M.MareCompress(url=self.url, timeout=0.5)
            data = chat(LONG_HTML)
            t0 = time.monotonic()
            self.assertIs(hook(cb, data), data, mode)
            self.assertLess(time.monotonic() - t0, 1.9, f"{mode}: the request waits at most about the timeout")
            self.assertEqual(data["messages"][3]["content"], LONG_HTML, mode)
        cb = M.MareCompress(url="http://127.0.0.1:9/compress", timeout=0.5)
        data = chat(LONG_HTML)
        self.assertIs(hook(cb, data), data, "nothing listens there")
        self.assertEqual(data["messages"][3]["content"], LONG_HTML)

    def test_the_hook_never_raises(self):
        for data in ({"messages": "not a list"}, {"messages": [None, 3, {"role": "tool", "content": 7}]}, {"input": "x"}, {}):
            self.assertIs(hook(self.cb, data), data)

    def test_the_same_text_is_sent_once_and_errors_are_not_remembered(self):
        hook(self.cb, chat(LONG_HTML))
        data = chat(LONG_HTML)
        hook(self.cb, data)
        self.assertEqual(len(Stand.seen), 1)
        self.assertEqual(data["messages"][3]["content"], " ".join(LONG_HTML.split()), "the remembered answer is used")
        Stand.mode = "busy"
        hook(self.cb, chat(LONG_JSON))
        Stand.mode = "ok"
        data = chat(LONG_JSON)
        hook(self.cb, data)
        self.assertEqual(data["messages"][3]["content"], " ".join(LONG_JSON.split()), "asked again after a failure")

    def test_at_most_max_texts_are_sent_per_request(self):
        cb = M.MareCompress(url=self.url, timeout=0.5, max_texts=2)
        data = {"messages": [{"role": "tool", "tool_call_id": str(i), "content": LONG_HTML + str(i)} for i in range(5)]}
        hook(cb, data)
        self.assertEqual(len(Stand.seen), 2)

    def test_settings_from_the_environment_and_bad_values(self):
        os.environ.update({"MARE_COMPRESS_MIN_CHARS": "50", "MARE_COMPRESS_TIMEOUT": "nope", "MARE_COMPRESS_MAX_TEXTS": "3"})
        try:
            cb = M.MareCompress(url=self.url)
            self.assertEqual((cb.min_chars, cb.timeout, cb.max_texts), (50, 4.0, 3))
        finally:
            for k in ("MARE_COMPRESS_MIN_CHARS", "MARE_COMPRESS_TIMEOUT", "MARE_COMPRESS_MAX_TEXTS"):
                os.environ.pop(k, None)

    @unittest.skipUnless(os.environ.get("MARE_COMPRESS_LIVE_URL"), "no node named in MARE_COMPRESS_LIVE_URL")
    def test_live_a_node_of_mare_liberum(self):
        cb = M.MareCompress(url=os.environ["MARE_COMPRESS_LIVE_URL"], timeout=4)
        data = {"messages": [
            {"role": "user", "content": "What do the plans cost?"},
            {"role": "tool", "tool_call_id": "a", "content": LONG_HTML},
            {"role": "tool", "tool_call_id": "b", "content": LONG_JSON},
            {"role": "tool", "tool_call_id": "c", "content": "Plan 1: 3 EUR. " * 4},
        ]}
        hook(cb, data)
        html, js, short = (m["content"] for m in data["messages"][1:])
        self.assertLess(len(html.encode()), len(LONG_HTML.encode()))
        self.assertNotIn("<p", html, "HTML came back as Markdown")
        self.assertIn("Plan 119", html)
        self.assertLess(len(js.encode()), len(LONG_JSON.encode()))
        try:
            self.assertEqual(json.loads(js), json.loads(LONG_JSON), "JSON came back minified, without loss")
        except ValueError:
            self.assertIn("server 79", js, "or as TOON, with every row")
        self.assertEqual(short, "Plan 1: 3 EUR. " * 4)
        self.assertEqual(data["messages"][0]["content"], "What do the plans cost?")


if __name__ == "__main__":
    result = unittest.main(exit=False, verbosity=2).result
    sys.exit(0 if result.wasSuccessful() else 1)
