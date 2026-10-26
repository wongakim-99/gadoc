"""Inventory public official documentation, not a claim of behavioral coverage."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import json
import re

BASE = "https://www.notion.com"
OUT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.links = set()

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.add(urljoin(self.url, href).split("#")[0].split("?")[0].rstrip("/"))


def fetch(url):
    try:
        request = Request(url, headers={"User-Agent": "Mozilla/5.0 (Notion feature research)"})
        with urlopen(request, timeout=30) as response:
            raw = response.read()
            text = raw.decode("utf-8")
            parser = Links(response.url)
            parser.feed(text)
            return {
                "url": url, "final_url": response.url, "status": response.status,
                "sha256": sha256(raw).hexdigest(), "links": sorted(parser.links),
            }
    except Exception as exc:
        return {"url": url, "status": "fetch_failed", "error": str(exc), "links": []}


def main():
    root = fetch(BASE + "/help")
    categories = sorted(u for u in root["links"] if "/help/category/" in u)
    targets = [u + "/all" for u in categories]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch, targets))
    articles = {}
    guides = {}
    for result in results:
        category = result["url"].split("/category/")[-1].removesuffix("/all")
        for url in result["links"]:
            path = urlparse(url).path
            if urlparse(url).hostname != "www.notion.com":
                continue
            if not path.startswith("/help/") or "/category/" in path:
                continue
            if path.rstrip("/") == "/help":
                continue
            destination = guides if "/guides/" in path else articles
            entry = destination.setdefault(url, {"url": url, "categories": [], "status": "cataloged_only"})
            entry["categories"].append(category)
    # Help sidebar links are repeated across categories. The category memberships
    # are discovery provenance, not asserted semantic classification.
    api_url = "https://developers.notion.com/llms.txt"
    with urlopen(Request(api_url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
        api_raw = response.read()
    api_urls = sorted(set(re.findall(r"\]\((https://developers\.notion\.com/[^)]+)\)", api_raw.decode())))
    output = {
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "scope": "English help category/all links and developer llms.txt; discovery only, not complete behavior analysis",
        "category_pages": results,
        "help_articles": sorted(articles.values(), key=lambda x: x["url"]),
        "help_guides": sorted(guides.values(), key=lambda x: x["url"]),
        "developer_index": {"url": api_url, "sha256": sha256(api_raw).hexdigest()},
        "developer_pages": [{"url": u, "status": "cataloged_only"} for u in api_urls],
        "limitations": [
            "Notion Mail's separate help directory and unlinked articles may be absent.",
            "Repeated header/sidebar links can give irrelevant discovery-category memberships.",
            "An indexed article is not a reviewed feature, runtime observation or exhaustive subfeature inventory.",
            "Regional/plan/beta rollouts and live account behavior remain unverified.",
        ],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "source-catalog.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "category_pages": len(results), "category_failures": [r["url"] for r in results if r["status"] != 200],
        "help_articles": len(articles), "help_guides": len(guides), "developer_pages": len(api_urls),
    }))


if __name__ == "__main__":
    main()
