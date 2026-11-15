#!/usr/bin/env python3
"""Browser smoke test for Star Catcher.

Needs: pip install playwright && playwright install chromium
Run: python3 test/smoke.py
Serves the folder locally, drives the game with clicks/keys, and
checks the main menu, stats screen, pause menu and service worker.
"""
import functools
import http.server
import socket
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(port):
    handler = functools.partial(Quiet, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    from playwright.sync_api import sync_playwright

    port = free_port()
    httpd = serve(port)
    results = []

    def check(name, cond, extra=""):
        results.append(bool(cond))
        print(("PASS" if cond else "FAIL"), name, extra)

    try:
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(channel="chrome", headless=True)
            except Exception:
                browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 500, "height": 800})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load")
            page.wait_for_timeout(800)

            state = lambda: page.evaluate("() => window.__game.state")
            check("loads to ready", state() == "ready", state())

            # click the stats item (index 4 of 7) on the title menu
            box = page.locator("#game").bounding_box()
            sx, sy = box["width"] / 400, box["height"] / 600
            page.mouse.click(box["x"] + 200 * sx, box["y"] + (270 + 4 * 34 + 8) * sy)
            page.wait_for_timeout(300)
            check("click selects stats", state() == "stats", state())
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            check("esc backs out", state() == "ready", state())

            # click play (index 0)
            page.mouse.click(box["x"] + 200 * sx, box["y"] + (270 + 0 * 34 + 8) * sy)
            page.wait_for_timeout(300)
            check("click play starts", state() == "playing", state())
            page.wait_for_timeout(1500)

            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            check("escape pauses", state() == "paused", state())
            page.keyboard.press("Enter")
            page.wait_for_timeout(300)
            check("enter resumes", state() == "playing", state())

            sw = page.evaluate(
                "() => navigator.serviceWorker ? "
                "navigator.serviceWorker.getRegistrations().then(r => r.length) : -1"
            )
            check("service worker", sw >= 1, sw)
            check("no page errors", not errors, "; ".join(errors[:3]))
            browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    failed = results.count(False)
    print(f"{len(results) - failed}/{len(results)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
