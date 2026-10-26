"""Build a citation/identifier ledger. Citation presence does NOT mean verification."""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from datetime import datetime, timezone
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
REPORTS = [
    "01-content-collaboration-admin.md",
    "02-databases-properties-formulas.md",
    "03-ai-automation-api-calendar-mail.md",
    "04-runtime-research-protocol.md",
    "05-evidence-conflicts-and-availability.md",
]
FEATURE = re.compile(r"(?<![A-Z0-9-])(?:AI|AU|API|CAL|MAIL|EXT|C|W|A|D|P|V|F)-\d{2,3}(?!\d)")
URL = re.compile(r"https://(?:www\.notion\.com|developers\.notion\.com)/[^\s)>\]|]+")


def normalize(url):
    parts = urlsplit(url.rstrip(".,;"))
    path = re.sub(r"^/(?:en-gb|en-us)/", "/", parts.path).removesuffix(".md").rstrip("/")
    return urlunsplit((parts.scheme, parts.netloc, path, "", ""))


def main():
    catalog = json.loads((ROOT / "source-catalog.json").read_text(encoding="utf-8"))
    references = {}
    features = []
    documents = []
    for filename in REPORTS:
        file = ROOT / filename
        content = file.read_text(encoding="utf-8")
        ids = {}
        owned_prefixes = {
            "01": {"C", "W", "A"},
            "02": {"D", "P", "V", "F"},
            "03": {"AI", "AU", "API", "CAL", "MAIL", "EXT"},
        }.get(filename[:2], set())
        for line_no, line in enumerate(content.splitlines(), 1):
            for feature_id in FEATURE.findall(line):
                if feature_id.split("-")[0] in owned_prefixes:
                    ids.setdefault(feature_id, line_no)
        if filename.startswith(("01-", "02-", "03-")):
            features += [
                {"id": key, "report": filename, "first_reference_line": line,
                 "runtime_status": "not_executed", "evidence_status": "see_report"}
                for key, line in sorted(ids.items())
            ]
        urls = sorted(set(URL.findall(content)))
        for url in urls:
            row = references.setdefault(normalize(url), {"raw_urls": [], "reports": []})
            if url not in row["raw_urls"]:
                row["raw_urls"].append(url)
            if filename not in row["reports"]:
                row["reports"].append(filename)
        documents.append({
            "file": filename, "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
            "feature_identifiers": len(ids) if filename.startswith(("01-", "02-", "03-")) else 0,
            "official_source_references": len(urls),
        })
    entries = []
    for group in ["help_articles", "help_guides", "developer_pages"]:
        for source in catalog.get(group, []):
            ref = references.get(normalize(source["url"]))
            entries.append({
                "url": source["url"], "catalog_group": group,
                "categories": source.get("categories", []),
                "reference_status": "referenced_in_report" if ref else "not_referenced_in_report",
                "reports": ref["reports"] if ref else [],
                "review_status": "not_inferred_from_citation",
                "runtime_status": "not_executed",
            })
    summary = {
        "help_categories": len(catalog["category_pages"]),
        "help_articles": len(catalog["help_articles"]),
        "help_guides": len(catalog.get("help_guides", [])),
        "developer_pages": len(catalog["developer_pages"]),
        "catalog_entries": len(entries),
        "unique_official_source_references": len(references),
        "feature_analysis_identifiers": len(features),
        "authenticated_runtime_cases_executed": 0,
    }
    ledger = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "interpretation": [
            "Analysis IDs differ in granularity and are not the total number of Notion features.",
            "A citation can be DOC, cached, contradictory or merely discovered. Read its report context.",
            "An uncited page may duplicate a covered feature, be a legacy reference, or represent a real gap.",
            "No source count is a completion percentage. Authenticated runtime validation remains unexecuted.",
            "This ledger never upgrades a documentation claim to runtime verification.",
        ],
        "documents": documents, "feature_index": features,
        "official_references": references, "catalog_coverage": entries,
    }
    (ROOT / "coverage-ledger.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# 조사 범위 추적표", "",
        "이 표는 출처 인용과 분석 식별자를 연결한다. 읽은 문서 수나 기능 검증 완료율을 계산하지 않는다.", "",
        "| 지표 | 수 | 의미 |", "|---|---:|---|",
        f"| 공식 도움말 분류 | {summary['help_categories']} | 디렉터리 수집 |",
        f"| 도움말 문서 | {summary['help_articles']} | 링크 목록 |",
        f"| 보충 가이드 | {summary['help_guides']} | 링크 목록, 전체 본문 검토 아님 |",
        f"| 개발자 문서 | {summary['developer_pages']} | API/Workers/CLI/가이드/legacy 포함 |",
        f"| 보고서의 공식 출처 | {summary['unique_official_source_references']} | DOC·발견·캐시·상충 인용 포함 |",
        f"| 분석 식별자 | {summary['feature_analysis_identifiers']} | 단위 크기가 다른 분석 항목 |",
        "| 로그인 후 실행 검증 | 0 | 미실행 |", "",
        "## 분야별 문서", "", "| 보고서 | 분석 ID | 공식 URL 참조 |", "|---|---:|---:|",
    ]
    for doc in documents:
        lines.append(f"| [{doc['file']}]({doc['file']}) | {doc['feature_identifiers']} | {doc['official_source_references']} |")
    lines += [
        "", "## 상세 추적", "",
        "- [coverage-ledger.json](coverage-ledger.json): 모든 카탈로그 URL의 인용 여부, 보고서 위치, 분석 ID.",
        "- [source-catalog.json](source-catalog.json): 원본 디렉터리별 발견 경로와 수집 해시.",
        "- 인용이 없는 문서를 자동으로 분석 완료 또는 불필요로 분류하지 않는다.",
        "- 실제 확인 수준은 각 보고서의 DOC/DOC-CACHED/UNKNOWN과 미확인 항목을 읽어 판정한다.",
        "- 기능 확인을 끝내려면 [런타임 조사 절차](04-runtime-research-protocol.md)의 실제 실행 기록이 필요하다.",
    ]
    (ROOT / "06-coverage.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
