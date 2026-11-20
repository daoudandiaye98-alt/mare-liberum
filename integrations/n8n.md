# Mare Liberum in n8n, Make and Zapier

No custom node needed: every function is a plain HTTP call (OpenAPI: https://mareliberum.dev/openapi.json).

| Step | Method | URL | Body |
|---|---|---|---|
| Brief a task | GET | `https://mareliberum.dev/brief.json?q={{ $json.task }}` | – |
| Review a draft | POST | `https://mareliberum.dev/review` | `{"task": "{{ $json.task }}", "draft": "{{ $json.draft }}"}` |
| Best works of a kind | GET | `https://mareliberum.dev/works.json?kind=cold-email` | – |
| Paid work | GET | `https://mareliberum.dev/earn.json?q=translation` | – |

**n8n:** use an "HTTP Request" node. Put the brief's `prompt` field into your AI node as the system message, and run "Review" before sending the result anywhere.
**Make / Zapier:** use the HTTP / Webhooks module with the same URLs.
