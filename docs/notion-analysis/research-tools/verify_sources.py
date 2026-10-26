"""Check citation reachability; a 200 response is not a verification of its claims."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from hashlib import sha256
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
URL = re.compile(r"https://(?:www\.notion\.com|developers\.notion\.com)/[^\s)>\]|]+")


class Title(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.parts = []
        self.finished = False

    def handle_starttag(self, tag, attrs):
        if tag == "h1" and not self.finished:
            self.active = True

    def handle_endtag(self, tag):
        if tag == "h1" and self.active:
            self.active = False
            self.finished = True

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)


def check(url):
    try:
        with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=25) as response:
            body = response.read()
            content_type = response.headers.get("Content-Type", "")
            text = body.decode("utf-8", errors="replace")
            parser = Title()
            parser.feed(text)
            heading = " ".join(parser.parts).strip()[:180]
            if not heading and "text/plain" in content_type:
                heading = next((line.strip("# ") for line in text.splitlines() if line.startswith("# ")), "")[:180]
            original_path = urlsplit(url).path.rstrip("/")
            final_path = urlsplit(response.url).path.rstrip("/")
            help_home = bool(re.fullmatch(r"/(?:en-gb/)?help", final_path)) and original_path != final_path
            return {
                "url": url, "status": response.status, "final_url": response.url,
                "first_heading": heading, "sha256": sha256(body).hexdigest(),
                "attention": "redirected_to_help_home" if help_home else None,
            }
    except Exception as exc:
        return {"url": url, "status": "fetch_failed", "error": str(exc), "attention": "needs_source_recheck"}


def main():
    urls = set()
    for filename in [
        "01-content-collaboration-admin.md", "02-databases-properties-formulas.md",
        "03-ai-automation-api-calendar-mail.md", "05-evidence-conflicts-and-availability.md",
    ]:
        urls.update(URL.findall((ROOT / filename).read_text(encoding="utf-8")))
    previous = {}
    output_path = ROOT / "source-access-check.json"
    if "--incremental" in sys.argv and output_path.exists():
        cached = json.loads(output_path.read_text(encoding="utf-8"))
        for row in cached["results"]:
            row.setdefault("checked_at", cached["checked_at"])
            previous[row["url"]] = row
    pending = sorted(urls - previous.keys())
    checked_at = datetime.now(timezone.utc).isoformat()
    with ThreadPoolExecutor(max_workers=4) as pool:
        fresh = list(pool.map(check, pending))
    for row in fresh:
        row["checked_at"] = checked_at
        previous[row["url"]] = row
    results = [previous[url] for url in sorted(urls)]
    output = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "meaning": "HTTP access check only; does not prove source supports its cited claims or any runtime behavior.",
        "results": results,
    }
    (ROOT / "source-access-check.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    attention = [r for r in results if r.get("attention")]
    print(json.dumps({"checked": len(results), "newly_checked": len(fresh), "attention": attention}, ensure_ascii=False))


if __name__ == "__main__":
    main()
