/* UX-only prototype: canonical records in memory; no API, audio or durable storage. */
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const records = {
  "meeting-1": {
    id: "meeting-1",
    type: "meeting",
    title: "온보딩 개선 방향 회의",
    project: "project-1",
    owner: "소연",
    date: "2026-10-26",
    status: "준비",
    body: "처음 들어온 팀원이 자료를 쉽게 찾을 수 있는지 확인합니다.\n\n안건\n1. 문서와 대화의 탐색 경로\n2. 회의 이후 작업을 놓치지 않는 방법",
    source: "message-1",
  },
  "meeting-2": {
    id: "meeting-2",
    type: "meeting",
    title: "고객 피드백 검토",
    project: "project-2",
    owner: "지민",
    date: "2026-10-27",
    status: "준비",
    body: "다른 프로젝트의 회의입니다. 프로젝트 필터가 원본을 복제하지 않는지 확인할 수 있습니다.",
  },
  "task-1": {
    id: "task-1",
    type: "task",
    title: "첫 방문 안내 문구 정리",
    project: "project-1",
    meeting: null,
    owner: "지민",
    date: "2026-10-28",
    status: "진행",
    body: "첫 화면에서 자료 위치와 다음 행동을 이해할 수 있게 안내합니다.",
  },
  "task-2": {
    id: "task-2",
    type: "task",
    title: "기존 문서 링크 확인",
    project: "project-1",
    meeting: null,
    owner: "소연",
    date: "2026-10-27",
    status: "완료",
    body: "기존 문서의 ID와 링크를 보존합니다.",
  },
  "task-3": {
    id: "task-3",
    type: "task",
    title: "피드백 분류",
    project: "project-2",
    meeting: null,
    owner: "지민",
    date: "2026-10-29",
    status: "할 일",
    body: "다른 프로젝트의 업무입니다.",
  },
  "doc-1": {
    id: "doc-1",
    type: "doc",
    title: "새 팀원의 첫 일주일",
    project: "project-1",
    owner: "소연",
    date: "2026-10-25",
    status: "검토 중",
    body: "팀에 합류하면 먼저 프로젝트의 목표와 최근 결정 사항을 확인합니다.\n\n자료실과 프로젝트 페이지에서 같은 문서를 열고 편집할 수 있습니다.",
  },
};
const projects = { "project-1": "온보딩 개선", "project-2": "고객 피드백" };
const kinds = {
  meeting: "회의록",
  task: "업무",
  doc: "자료",
  decision: "결정",
};
const routes = {
  project: "온보딩 개선",
  chat: "제품 논의",
  meetings: "회의록",
  tasks: "업무 데이터베이스",
  decisions: "결정 기록",
  library: "자료실",
  mine: "내 작업",
};
let route = "project",
  viewMode = "table",
  projectFilter = "",
  ownerFilter = "",
  sort = "date",
  showDate = true,
  linkedVisible = true,
  dialogRecord = null,
  previousFocus = null,
  sequence = 4,
  toastTimer;
const all = (type) => Object.values(records).filter((r) => r.type === type);
const projectTasks = () => all("task").filter((r) => r.project === "project-1");
const statusOptions = (record) =>
  record.type === "task"
    ? ["할 일", "진행", "완료"]
    : record.type === "meeting"
      ? ["준비", "진행", "정리 중", "확정"]
      : record.type === "decision"
        ? ["제안", "확정"]
        : ["검토 중", "확인됨"];
const pill = (text) =>
  `<span class="pill ${text === "완료" || text === "확정" ? "complete" : ""}">${escapeHtml(text)}</span>`;
const openButton = (record) =>
  `<button data-open="${record.id}">${escapeHtml(record.title)}</button>`;
function statusSelect(record) {
  return `<select data-status="${record.id}" aria-label="${escapeHtml(record.title)} 상태">${statusOptions(
    record,
  )
    .map(
      (s) => `<option ${s === record.status ? "selected" : ""}>${s}</option>`,
    )
    .join("")}</select>`;
}
function table(rows, editable = true) {
  return `<div class="table-wrap"><table><thead><tr><th>이름</th><th>상태</th><th>담당자</th><th>프로젝트 · 관계</th>${showDate ? "<th>날짜</th>" : ""}</tr></thead><tbody>${rows.map((r) => `<tr data-record="${r.id}"><td>${openButton(r)}</td><td>${editable && r.type === "task" ? statusSelect(r) : pill(r.status)}</td><td>${r.owner}</td><td><button class="text-link" data-project="${r.project}">${projects[r.project]}</button></td>${showDate ? `<td>${r.date}</td>` : ""}</tr>`).join("")}</tbody></table></div>${rows.length ? "" : '<div class="empty">현재 보기 조건에 맞는 항목이 없습니다. 필터를 변경해 보세요.</div>'}<div class="db-footer">${rows.length}개 항목 · 클릭하면 속성과 본문이 있는 같은 페이지가 열립니다.</div>`;
}
function board(rows) {
  return `<div class="board">${["할 일", "진행", "완료"]
    .map((status) => {
      const list = rows.filter((r) => r.status === status);
      return `<section class="column"><div class="column-title"><b>${status}</b><span>${list.length}</span></div>${list.map((r) => `<div class="card"><small>${r.id.toUpperCase()}</small>${openButton(r)}<p class="small muted">${r.owner} · ${projects[r.project]}</p>${statusSelect(r)}</div>`).join("")}</section>`;
    })
    .join("")}</div>`;
}
function relation(record) {
  return `<div class="property"><span>종류</span><span>${kinds[record.type]}</span><span>프로젝트</span><span><button data-project="${record.project}">${projects[record.project]} ↗</button></span><span>담당자</span><span>${record.owner}</span><span>날짜</span><span>${record.date}</span><span>상태</span><span>${record.type === "task" || record.type === "decision" ? statusSelect(record) : pill(record.status)}</span>${record.meeting ? `<span>회의 · 관계</span><span>${openButton(records[record.meeting])}</span>` : ""}${record.source ? '<span>출처</span><span><button data-route="chat">제품 논의 / 원문 메시지 ↗</button></span>' : ""}</div>`;
}
function projectPage() {
  const tasks = projectTasks(),
    done = tasks.filter((r) => r.status === "완료").length,
    rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return `<div class="page"><div class="eyebrow">프로젝트 / 페이지</div><div class="title-row"><h1>온보딩 개선</h1><button class="btn primary" data-open="meeting-1">회의 준비</button></div><p class="muted">처음 온 팀원도 팀의 자료와 다음 할 일을 스스로 찾게 합니다.</p><div class="metrics"><div><strong data-testid="rollup">${done} / ${tasks.length}</strong><div class="small muted">완료된 업무 · 관계 집계</div></div><div class="progress" aria-label="완료율 ${rate}%"><i style="width:${rate}%"></i></div><span class="small">${rate}% 완료</span></div><h2>이번 주의 논의</h2><button class="record-row" data-open="meeting-1"><b>▤　온보딩 개선 방향 회의</b><span>${records["meeting-1"].status} · 10월 26일</span></button><h2>결정 기록</h2>${
    all("decision")
      .filter((r) => r.project === "project-1")
      .map(
        (r) =>
          `<button class="record-row" data-open="${r.id}"><b>◇　${escapeHtml(r.title)}</b><span>${r.status}</span></button>`,
      )
      .join("") ||
    '<p class="muted small">아직 확정한 결정이 없습니다. 회의 기록에서 남긴 결정을 여기에 연결합니다.</p>'
  }<section class="linked"><div class="title-row"><h2>진행할 업무</h2><div class="actions"><button class="btn" data-action="new-task">＋ 업무</button><button class="btn" data-action="toggle-link">${linkedVisible ? "이 보기 제거" : "업무 보기 다시 연결"}</button></div></div>${linkedVisible ? `<p class="source">원본: 업무 데이터베이스 · 필터: 프로젝트 = 온보딩 개선 · 원본과 같은 항목</p>${table(tasks)}` : '<div class="note">이 페이지의 보기만 제거했습니다. 업무 원본과 항목은 그대로 남아 있습니다. <button class="text-link" data-route="tasks">업무 원본 열기 →</button></div>'}</section><h2>함께 읽을 자료</h2><button class="record-row" data-open="doc-1"><b>▧　새 팀원의 첫 일주일</b><span>자료실의 원본 페이지 ↗</span></button></div>`;
}
function databasePage() {
  const type = {
    meetings: "meeting",
    tasks: "task",
    mine: "task",
    decisions: "decision",
    library: "doc",
  }[route];
  let rows = all(type).filter(
    (r) =>
      (!projectFilter || r.project === projectFilter) &&
      (!ownerFilter || r.owner === ownerFilter) &&
      (route !== "mine" || r.owner === "지민"),
  );
  rows.sort((a, b) => String(a[sort]).localeCompare(String(b[sort]), "ko"));
  return `<div class="page"><div class="eyebrow">${route === "mine" ? "업무 데이터베이스 / 담당자 = 나" : "데이터베이스 / 원본"}</div><div class="title-row"><div><h1>${routes[route]}</h1><p class="muted small">${route === "mine" ? "담당자 지민으로 필터된 동일 업무 원본입니다." : "각 항목은 속성과 본문을 가진 페이지입니다."}</p></div>${type === "task" ? '<button class="btn primary" data-action="new-task">＋ 새 업무</button>' : ""}</div><div class="toolbar">${type === "task" ? `<div class="switcher" aria-label="표시 방식"><button data-mode="table" aria-pressed="${viewMode === "table"}">표</button><button data-mode="board" aria-pressed="${viewMode === "board"}">보드</button></div>` : '<b class="small">전체 목록</b>'}<select id="project-filter" aria-label="프로젝트 필터"><option value="">모든 프로젝트</option>${Object.entries(
    projects,
  )
    .map(
      ([id, name]) =>
        `<option value="${id}" ${projectFilter === id ? "selected" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select><select id="owner-filter" aria-label="담당자 필터"><option value="">모든 담당자</option>${["지민", "소연"].map((n) => `<option ${ownerFilter === n ? "selected" : ""}>${n}</option>`).join("")}</select><select id="sort" aria-label="정렬"><option value="date" ${sort === "date" ? "selected" : ""}>날짜순</option><option value="title" ${sort === "title" ? "selected" : ""}>제목순</option></select><button class="btn" data-action="columns">날짜 열 ${showDate ? "숨기기" : "표시"}</button></div><p class="source">보기 설정은 임시 개인 설정 · 항목 값의 변경은 모든 연결된 보기에 반영</p>${viewMode === "board" && type === "task" ? board(rows) : table(rows)}</div>`;
}
function chatPage() {
  return `<div class="page reading"><div class="eyebrow">채널 / 제품 논의</div><h1>제품 논의</h1><p class="muted small">대화는 그대로 유지하고 필요한 기록만 연결합니다.</p><div class="message"><span class="avatar">소</span><div><b>소연</b><time>10:24</time><p>새 팀원이 어디서 자료를 찾아야 할지 모르겠다고 해요.<br>온보딩 회의에서 동선을 같이 정리하면 좋겠어요.</p><div class="actions"><button class="btn" data-open="meeting-1">연결된 회의록 열기</button><button class="btn" data-action="capture">자료로 남기기</button></div></div></div><div class="note"><b>연결된 기록</b><p><button class="text-link" data-open="meeting-1">온보딩 개선 방향 회의 ↗</button> · ${records["meeting-1"].status}</p><p class="small muted">회의 결과는 같은 기록에 쌓입니다. 별도 회의록 사본을 만들지 않습니다.</p></div>${all(
    "doc",
  )
    .filter((r) => r.source === "message-1")
    .map(
      (r) =>
        `<button class="record-row" data-open="${r.id}"><b>▧ ${escapeHtml(r.title)}</b><span>자료실에 남긴 기록 ↗</span></button>`,
    )
    .join("")}</div>`;
}
function render() {
  const offset = $("#content").scrollTop;
  $("#content").innerHTML =
    route === "project"
      ? projectPage()
      : route === "chat"
        ? chatPage()
        : databasePage();
  $("#location").textContent = routes[route];
  document.querySelectorAll("aside [data-route]").forEach((el) => {
    if (el.dataset.route === route) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  $("#content").scrollTop = offset;
}
function navigate(next) {
  route = next;
  projectFilter = "";
  ownerFilter = "";
  viewMode = "table";
  showDate = true;
  close();
  render();
  $("#content").scrollTop = 0;
  $("#nav").classList.remove("open");
  $("#menu").setAttribute("aria-expanded", "false");
  $("#content").focus();
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
function close() {
  if ($("#overlay").hidden) return;
  $("#overlay").hidden = true;
  $("#overlay").innerHTML = "";
  dialogRecord = null;
  $(".shell").inert = false;
  if (previousFocus?.isConnected) previousFocus.focus();
  else $("#content").focus();
}
function panel(title, body, recordId = null) {
  if ($("#overlay").hidden) previousFocus = document.activeElement;
  $(".shell").inert = true;
  dialogRecord = recordId;
  $("#overlay").hidden = false;
  $("#overlay").className = "modal-bg";
  $("#overlay").innerHTML =
    `<section class="panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><b id="dialog-title">${title}</b><button data-action="close" aria-label="닫기">✕</button></header>${body}</section>`;
  $("#overlay button").focus();
}
function openRecord(id) {
  const r = records[id];
  if (!r) return;
  const head = `<span class="eyebrow">${kinds[r.type]} / 같은 원본 페이지 · ${r.id}</span><h1>${escapeHtml(r.title)}</h1>${relation(r)}`;
  if (r.type === "meeting") {
    const next = {
      준비: ["회의 시작", "진행"],
      진행: ["통화 종료", "정리 중"],
      "정리 중": ["기록 확정", "확정"],
    }[r.status];
    const linked = all("task").filter((t) => t.meeting === id);
    panel(
      "회의 기록",
      `${head}<div class="stage">${["준비", "진행", "정리 중", "확정"].map((s) => (s === r.status ? `<b>${s}</b>` : `<span>${s}</span>`)).join(" → ")}${next ? `<button class="btn primary" data-next="${next[1]}" data-id="${id}">${next[0]}</button>` : ""}</div>${r.status === "진행" ? '<div class="session">진행 상태 시뮬레이션 · 실제 마이크/통화 연결 없음</div>' : ""}<h2>안건과 논의</h2><label class="small muted" for="body">메모 · 입력 즉시 시안 메모리에 반영</label><textarea class="body-editor" id="body" data-body="${id}">${escapeHtml(r.body)}</textarea><h2>논의에서 남길 내용</h2><div class="quote"><p>새 팀원 안내를 한 페이지에서 시작하고, 자료는 원본을 연결합니다.</p><button class="btn" data-action="decision">${records["decision-1"] ? "연결된 결정 열기" : "결정으로 남기기"}</button></div><h2>후속 작업</h2>${linked.map((t) => `<button class="record-row" data-open="${t.id}"><span>${escapeHtml(t.title)}</span><span>${t.status} · ${t.owner}</span></button>`).join("") || '<p class="muted small">작업을 만들면 이 회의와 프로젝트, 담당자의 내 작업에 함께 표시됩니다.</p>'}<button class="btn" data-action="meeting-task">＋ 논의를 작업으로 만들기</button>${r.status === "확정" ? '<div class="note">기록을 확정했습니다. 확정은 저장과 다른 업무 상태이며, 다른 사람에게 자동 공개하거나 알림을 보내지 않습니다.</div>' : ""}`,
      id,
    );
  } else
    panel(
      "기록 상세",
      `${head}<h2>본문</h2><label class="small muted" for="body">시안 메모리에 자동 반영</label><textarea class="body-editor" id="body" data-body="${id}">${escapeHtml(r.body)}</textarea><div class="note"><p>어느 보기에서 열어도 이 ID의 같은 본문·속성을 사용합니다.</p></div>`,
      id,
    );
}
function newTask(meeting = null) {
  const project = meeting
    ? records[meeting].project
    : route === "project"
      ? "project-1"
      : projectFilter || "project-1";
  panel(
    "후속 작업 만들기",
    `<p class="muted small">저장 위치: 업무 데이터베이스 · 현재 맥락을 관계로 연결합니다.</p><form id="new-task" data-meeting="${meeting || ""}"><label for="task-title">작업 이름</label><input id="task-title" required maxlength="120" value="${meeting ? "새 팀원 시작 페이지 구성" : ""}" placeholder="어떤 일을 해야 하나요?"><label for="task-owner">담당자</label><select id="task-owner"><option>지민</option><option>소연</option></select><label for="task-project">프로젝트 · 관계</label><select id="task-project">${Object.entries(
      projects,
    )
      .map(
        ([id, n]) =>
          `<option value="${id}" ${id === project ? "selected" : ""}>${n}</option>`,
      )
      .join(
        "",
      )}</select><label for="task-date">기한</label><input id="task-date" type="date" value="2026-10-30" required>${meeting ? `<p class="source">관련 회의: ${records[meeting].title} · 원문 연결 유지</p>` : ""}<button class="btn primary" type="submit">작업 만들기</button></form>`,
  );
  $("#task-title").focus();
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el) {
    if (e.target === $("#overlay")) close();
    return;
  }
  if (el.dataset.route) return navigate(el.dataset.route);
  if (el.dataset.open) return openRecord(el.dataset.open);
  if (el.dataset.project) {
    if (el.dataset.project === "project-1") navigate("project");
    else toast("고객 피드백은 다른 프로젝트의 필터 검증용 샘플입니다.");
    return;
  }
  if (el.dataset.mode) {
    viewMode = el.dataset.mode;
    render();
    return;
  }
  if (el.dataset.next) {
    records[el.dataset.id].status = el.dataset.next;
    render();
    openRecord(el.dataset.id);
    return;
  }
  switch (el.dataset.action) {
    case "close":
      close();
      break;
    case "toggle-link":
      linkedVisible = !linkedVisible;
      render();
      break;
    case "columns":
      showDate = !showDate;
      render();
      break;
    case "new-task":
      newTask();
      break;
    case "meeting-task":
      newTask(dialogRecord);
      break;
    case "decision":
      if (!records["decision-1"])
        records["decision-1"] = {
          id: "decision-1",
          type: "decision",
          title: "자료는 복제하지 않고 원본을 연결한다",
          project: "project-1",
          meeting: "meeting-1",
          owner: "소연",
          date: "2026-10-26",
          status: "제안",
          body: "회의에서 제안한 결정입니다. 검토 후 확정해야 합니다.",
        };
      render();
      openRecord("decision-1");
      break;
    case "capture":
      if (!records["doc-2"])
        records["doc-2"] = {
          id: "doc-2",
          type: "doc",
          title: "새 팀원 자료 탐색 피드백",
          project: "project-1",
          owner: "소연",
          date: "2026-10-26",
          status: "검토 중",
          body: "새 팀원이 자료 위치를 찾기 어렵다는 피드백을 받았습니다.\n원본 대화와 연결한 기록입니다.",
          source: "message-1",
        };
      render();
      openRecord("doc-2");
      toast(
        "자료실에 기록했습니다. 같은 메시지로 다시 실행해도 기존 기록을 엽니다.",
      );
      break;
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.status) {
    records[el.dataset.status].status = el.value;
    const id = dialogRecord;
    render();
    if (id) openRecord(id);
    toast(
      "같은 업무 원본을 변경했습니다. 회의록·프로젝트·내 작업에 반영됩니다.",
    );
    return;
  }
  if (el.id === "project-filter") projectFilter = el.value;
  else if (el.id === "owner-filter") ownerFilter = el.value;
  else if (el.id === "sort") sort = el.value;
  else return;
  render();
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.body)
    records[e.target.dataset.body].body = e.target.value;
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "new-task") return;
  e.preventDefault();
  const title = $("#task-title").value.trim();
  if (!title) return;
  const meeting = e.target.dataset.meeting || null;
  const duplicate = all("task").find(
    (t) => meeting && t.meeting === meeting && t.title === title,
  );
  if (duplicate) {
    openRecord(duplicate.id);
    toast("이 회의에 같은 제목의 작업이 있어 기존 작업을 열었습니다.");
    return;
  }
  const id = `task-${sequence++}`;
  records[id] = {
    id,
    type: "task",
    title,
    project: $("#task-project").value,
    owner: $("#task-owner").value,
    date: $("#task-date").value,
    status: "할 일",
    body: "회의의 논의에서 만든 후속 작업입니다.",
    meeting,
  };
  render();
  openRecord(id);
  toast("업무 원본에 추가했습니다. 연결된 보기에서 같은 항목을 확인하세요.");
});
$("#menu").onclick = () => {
  const isOpen = $("#nav").classList.toggle("open");
  $("#menu").setAttribute("aria-expanded", String(isOpen));
  if (isOpen) $("#nav button").focus();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    close();
    if ($("#nav").classList.contains("open")) {
      $("#nav").classList.remove("open");
      $("#menu").setAttribute("aria-expanded", "false");
      $("#menu").focus();
    }
  }
  if (e.key === "Tab" && !$("#overlay").hidden) {
    const nodes = [
      ...$("#overlay").querySelectorAll("button,input,select,textarea,a[href]"),
    ].filter((n) => !n.disabled && n.getClientRects().length);
    const first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
render();
