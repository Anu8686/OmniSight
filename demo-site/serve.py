"""Serve the demo site on http://127.0.0.1:5050 (static files only, loopback only)."""
import functools
import http.server
import sys
from pathlib import Path

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5050
root = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path(__file__).resolve().parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
handler.log_message = lambda *a, **k: None  # type: ignore[attr-defined]
with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
    print(f"Serving {root} on http://127.0.0.1:{port}")
    srv.serve_forever()
