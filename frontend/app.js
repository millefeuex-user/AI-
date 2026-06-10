const rubric = [
  {
    key: "problemValue",
    name: "问题价值",
    max: 35,
    help: "是否解决真实、有价值的业务或项目问题",
    bands: [
      { min: 32, max: 35, label: "真实且关键，属于业务核心痛点，价值可量化，影响范围广" },
      { min: 26, max: 31, label: "真实且重要，属于业务关键痛点，解决后有明确价值" },
      { min: 20, max: 25, label: "真实且有一定价值，偏局部优化或个人效率提升" },
      { min: 0, max: 19, label: "问题不清晰，或与真实业务脱节" },
    ],
  },
  {
    key: "usageDepth",
    name: "使用深度",
    max: 25,
    help: "是否合理、深入、系统化地使用AI",
    bands: [
      { min: 22, max: 25, label: "综合使用 Prompt、多轮迭代、Workflow、Agent、自动化等能力" },
      { min: 18, max: 21, label: "能设计结构化 Prompt，并通过多轮优化获得稳定结果" },
      { min: 14, max: 17, label: "能使用 AI 完成基础任务，但过程设计和迭代较简单" },
      { min: 0, max: 13, label: "简单问答或复制粘贴，缺少结构化设计和过程控制" },
    ],
  },
  {
    key: "deliveryQuality",
    name: "交付质量",
    max: 25,
    help: "交付成果是否完整、准确、可用、可验证",
    bands: [
      { min: 22, max: 25, label: "成果完整准确，可直接用于真实业务，并有明确验证证据" },
      { min: 18, max: 21, label: "MVP 或核心功能完成，可用于业务，但仍有优化空间" },
      { min: 14, max: 17, label: "可作为初稿或辅助材料，需要较多人工修改或验证不足" },
      { min: 0, max: 13, label: "成果不完整、不准确，无法实际使用" },
    ],
  },
  {
    key: "reuseAsset",
    name: "可复用沉淀",
    max: 15,
    help: "是否沉淀为模板、SOP、Workflow、Prompt、Skill或方法论",
    bands: [
      { min: 13, max: 15, label: "已沉淀为可复用资产，并具备跨团队推广价值" },
      { min: 10, max: 12, label: "有一定复用价值，但仍需进一步整理或标准化" },
      { min: 7, max: 9, label: "主要适合个人或本团队复用，跨团队复用性有限" },
      { min: 0, max: 6, label: "无明显沉淀，或未满足最低要求" },
    ],
  },
];

const state = {
  loading: true,
  view: "reviewer",
  user: null,
  config: null,
  assignments: [],
  summary: [],
  selectedAssignmentId: "",
  form: {},
  toast: "",
  redirecting: false,
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "请求失败");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function boot() {
  if (window.location.pathname === "/auth/callback") {
    await handleAuthCallback();
    return;
  }
  try {
    state.config = await api("/api/config");
    state.user = await getCurrentUser();
    await refreshData();
  } catch (error) {
    if (error.status === 401) {
      await redirectToFeishuOAuth();
      return;
    }
    showToast(error.message);
  } finally {
    if (!state.redirecting) {
      state.loading = false;
      render();
    }
  }
}

async function getCurrentUser() {
  const data = await api("/api/auth/me");
  return data.user;
}

async function redirectToFeishuOAuth() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const data = await api(`/api/auth/feishu/authorize?returnTo=${encodeURIComponent(returnTo || "/")}`);
  sessionStorage.setItem("ai_scoring_oauth_state", data.state);
  sessionStorage.setItem("ai_scoring_oauth_return_to", returnTo || "/");
  state.redirecting = true;
  document.querySelector("#app").innerHTML = `<div class="loading">正在跳转飞书授权...<br /><a href="${escapeHtml(data.authorizationUrl)}">如果没有自动跳转，请点击这里</a></div>`;
  window.location.assign(data.authorizationUrl);
}

async function handleAuthCallback() {
  const app = document.querySelector("#app");
  app.innerHTML = `<div class="loading">正在完成飞书登录...</div>`;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code") || "";
  const stateValue = params.get("state") || "";
  const errorValue = params.get("error") || "";
  const expectedState = sessionStorage.getItem("ai_scoring_oauth_state") || "";
  console.log("[auth] callback search:", window.location.search || "(empty)");
  console.log("[auth] callback hash:", window.location.hash || "(empty)");
  if (!code) {
    if (errorValue) {
      app.innerHTML = `<div class="loading">飞书登录失败：${escapeHtml(errorValue)}</div>`;
      return;
    }
    window.location.replace("/");
    return;
  }
  if (!stateValue || (expectedState && stateValue !== expectedState)) {
    app.innerHTML = `<div class="loading">飞书登录失败：state 校验失败，请重新打开应用。</div>`;
    return;
  }
  try {
    const data = await api("/api/auth/feishu/callback", {
      method: "POST",
      body: JSON.stringify({ code, state: stateValue }),
    });
    sessionStorage.removeItem("ai_scoring_oauth_state");
    const returnTo = data.returnTo || sessionStorage.getItem("ai_scoring_oauth_return_to") || "/";
    sessionStorage.removeItem("ai_scoring_oauth_return_to");
    window.location.replace(returnTo);
  } catch (error) {
    app.innerHTML = `<div class="loading">飞书登录失败：${escapeHtml(error.message)}</div>`;
  }
}

async function refreshData() {
  const assignmentData = await api("/api/assignments/me");
  state.assignments = assignmentData.assignments;
  const summaryData = await api("/api/admin/summary");
  state.summary = summaryData.summary;
}

function gradeOf(score) {
  if (score >= 90) return { label: "A 优秀", className: "green" };
  if (score >= 80) return { label: "B 良好", className: "teal" };
  if (score >= 70) return { label: "C 合格", className: "amber" };
  return { label: "不合格", className: "red" };
}

function totalOf(form) {
  return rubric.reduce((sum, item) => sum + Number(form[item.key] || 0), 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  const app = document.querySelector("#app");
  if (state.loading) {
    app.innerHTML = `<div class="loading">正在加载评分系统...</div>`;
    return;
  }
  const pending = state.assignments.filter((item) => !item.score).length;
  const done = state.assignments.length - pending;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">AI</div>
          <div>
            <div class="brand-title">AI课题评审台</div>
            <div class="brand-sub">AI Scoring System</div>
          </div>
        </div>
        <div class="user-card">
          <div class="user-name">${escapeHtml(state.user?.name || "未登录")}</div>
          <div class="user-meta">${escapeHtml(state.user?.department || state.user?.user_id || "")}</div>
        </div>
        <nav class="nav">
          ${navButton("reviewer", "我的评分", pending)}
          ${navButton("admin", "汇总看板", state.summary.length)}
          ${navButton("settings", "评分规则", 4)}
        </nav>
      </aside>
      <main class="main">
        ${mainContent(pending, done)}
      </main>
    </div>
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  `;
}

function navButton(view, label, count) {
  return `
    <button class="${state.view === view ? "active" : ""}" data-action="set-view" data-view="${view}">
      <span>${label}</span>
      <span class="pill">${count}</span>
    </button>
  `;
}

function mainContent(pending, done) {
  if (state.view === "admin") return adminView();
  if (state.view === "settings") return settingsView();
  if (state.selectedAssignmentId) return scoreView(state.selectedAssignmentId);
  return reviewerView(pending, done);
}

function metric(label, value) {
  return `<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div></div>`;
}

function reviewerView(pending, done) {
  return `
    <section class="topbar">
      <div>
        <div class="eyebrow">${state.config.mockMode ? "Mock模式" : "飞书多维表格已连接"}</div>
        <h1>我的待评分课题</h1>
        <p class="copy">系统根据当前飞书用户身份匹配评委关系，只展示分配给你的课题。</p>
      </div>
      <button class="button ghost" data-action="refresh">刷新数据</button>
    </section>
    <section class="metrics">
      ${metric("分配课题", state.assignments.length)}
      ${metric("待评分", pending)}
      ${metric("已完成", done)}
      ${metric("完成率", state.assignments.length ? `${Math.round((done / state.assignments.length) * 100)}%` : "0%")}
    </section>
    <section class="content-grid">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">评分任务</div>
          ${state.config.mockMode ? `<button class="button secondary" data-action="reset">重置演示数据</button>` : ""}
        </div>
        <div class="panel-body">
          ${state.assignments.length ? `<div class="topic-list">${state.assignments.map(topicCard).join("")}</div>` : `<div class="empty">暂无需要你评分的课题。</div>`}
        </div>
      </div>
      <aside class="panel">
        <div class="panel-header"><div class="panel-title">评分结构</div></div>
        <div class="panel-body"><div class="rubric-list">${rubric.map(rubricItem).join("")}</div></div>
      </aside>
    </section>
  `;
}

function topicCard(assignment) {
  const topic = assignment.topic;
  const grade = assignment.score ? gradeOf(assignment.score.total) : null;
  return `
    <article class="topic-card">
      <div class="topic-head">
        <div>
          <div class="topic-title">${escapeHtml(topic.title)}</div>
          <div class="meta">
            <span class="pill teal">${escapeHtml(assignment.reviewType)}</span>
            <span class="pill">${escapeHtml(topic.type)}</span>
            <span class="pill blue">${escapeHtml(topic.level)}</span>
            <span class="pill">${escapeHtml(topic.department)}</span>
            ${(topic.groupType === "leader" || topic.groupType === "team") && topic.leader ? `<span class="pill">组长：${escapeHtml(topic.leader)}</span>` : ""}
            ${assignment.score ? `<span class="pill ${grade.className}">${escapeHtml(grade.label)} · ${assignment.score.total}分</span>` : `<span class="pill amber">待评分</span>`}
          </div>
        </div>
        <div class="actions">
          <a class="button secondary" href="${escapeHtml(topic.materialUrl || "#")}" target="_blank" rel="noreferrer">材料</a>
          <button class="button" data-action="open-score" data-id="${assignment.id}">${assignment.score ? "查看评分" : "开始评分"}</button>
        </div>
      </div>
      <div class="topic-summary">${escapeHtml(topic.summary)}</div>
    </article>
  `;
}

function rubricItem(item) {
  return `<div class="rubric-item"><div class="rubric-score">${escapeHtml(item.name)} · ${item.max}分</div><div class="rubric-text">${escapeHtml(item.help)}</div></div>`;
}

function scoreView(assignmentId) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  const topic = assignment.topic;
  if (!state.form.assignmentId || state.form.assignmentId !== assignmentId) {
    state.form = assignment.score
      ? { ...assignment.score }
      : {
          assignmentId,
          topicId: topic.id,
          problemValue: 0,
          usageDepth: 0,
          deliveryQuality: 0,
          reuseAsset: 0,
          comment: "",
          highlights: "",
          suggestions: "",
          recommendCase: false,
        };
  }
  state.form.reviewType = state.form.reviewType || assignment.reviewType;
  state.form.reviewerIdentity = state.form.reviewerIdentity || assignment.reviewerIdentity;
  const total = totalOf(state.form);
  const grade = gradeOf(total);
  const isTeamLike = topic.groupType === "leader" || topic.groupType === "team";
  return `
    <section class="topbar">
      <div>
        <div class="eyebrow">${escapeHtml(assignment.reviewType)} · ${escapeHtml(topic.level)}</div>
        <h1>${escapeHtml(topic.title)}</h1>
        <p class="copy">${escapeHtml(topic.summary)}</p>
      </div>
      <button class="button secondary" data-action="back">返回列表</button>
    </section>
    <section class="score-layout">
      <aside class="panel">
        <div class="panel-header">
          <div class="panel-title">课题信息</div>
          <span class="pill ${assignment.score ? "green" : "amber"}">${assignment.score ? "已评分" : "待提交"}</span>
        </div>
        <div class="panel-body">
          <div class="subject-card">
            <div>
              <div class="label">${isTeamLike ? "评分主体" : "提交人/团队"}</div>
              <div class="subject-name">${escapeHtml(isTeamLike ? topic.leader || topic.owner : topic.owner)}</div>
            </div>
            <span class="pill teal">${escapeHtml(assignment.reviewType)}</span>
          </div>
          <div class="detail-list compact">
            ${detail(isTeamLike ? "组长字段" : "负责人字段", topic.leaderField || "负责人/花名")}
            ${isTeamLike && topic.ownerRaw && topic.ownerRaw !== topic.leader ? detail("原始成员/负责人", topic.ownerRaw) : ""}
            ${detail("所属部门", topic.department)}
            ${detail("课题类型", topic.type)}
            ${detail("申请等级", topic.level)}
          </div>
          <div class="link-list" style="margin-top: 18px;">
            ${link("交付材料", topic.materialUrl)}
            ${link("产品预览", topic.productUrl)}
          </div>
          ${topic.delivery ? `<div class="field-row" style="margin-top: 18px;"><label>交付物成果</label><div class="detail-value" style="white-space: pre-wrap; line-height: 1.7;">${escapeHtml(topic.delivery)}</div></div>` : ""}
          ${recordFieldsView(topic)}
        </div>
      </aside>
      <section class="panel">
        <div class="panel-header"><div class="panel-title">评分表</div><span class="pill ${grade.className}">${escapeHtml(grade.label)}</span></div>
        <div class="panel-body">
          <form class="score-form" data-action="submit-score">
            ${rubric.map((item) => dimension(item, state.form[item.key])).join("")}
            ${textarea("comment", "综合评语", "请填写评分依据、整体判断或关键观察")}
            ${textarea("highlights", "主要亮点", "可选")}
            ${textarea("suggestions", "改进建议", "可选")}
            <div class="field-row">
              <label>是否推荐优秀案例</label>
              <select data-field="recommendCase">
                <option value="false" ${!state.form.recommendCase ? "selected" : ""}>否</option>
                <option value="true" ${state.form.recommendCase ? "selected" : ""}>是</option>
              </select>
            </div>
            <div class="score-summary">
              <div><div class="total-score">${total}</div><div class="total-caption">当前总分 · ${escapeHtml(grade.label)}</div></div>
              <button class="button" type="submit">${assignment.score ? "更新评分" : "提交评分"}</button>
            </div>
          </form>
        </div>
      </section>
    </section>
  `;
}

function detail(label, value) {
  if (value == null || value === "") return "";
  return `<div class="detail-row"><div class="label">${escapeHtml(label)}</div><div class="detail-value">${escapeHtml(value)}</div></div>`;
}

function link(label, url) {
  if (!url) return "";
  return `<div class="link-item"><div><div class="label">${escapeHtml(label)}</div><div class="detail-value">${escapeHtml(url)}</div></div><a class="button secondary" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">打开</a></div>`;
}

function recordFieldsView(topic) {
  const fields = Array.isArray(topic.detailFields) ? topic.detailFields : [];
  if (!fields.length) return "";
  return `
    <section class="record-fields">
      <div class="record-fields-head">
        <div>
          <div class="panel-title small">原表完整信息</div>
          <div class="record-fields-sub">根据当前项目所在子表自动展示全部字段</div>
        </div>
        <span class="pill">${fields.length}项</span>
      </div>
      <div class="record-field-grid">
        ${fields.map((field) => detail(field.name, field.value)).join("")}
      </div>
    </section>
  `;
}

function textarea(field, label, placeholder) {
  return `<div class="field-row"><label>${escapeHtml(label)}</label><textarea data-field="${field}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(state.form[field] || "")}</textarea></div>`;
}

function dimension(item, value) {
  const active = item.bands.find((band) => Number(value) >= band.min && Number(value) <= band.max);
  return `
    <section class="dimension">
      <div class="dimension-head"><div><div class="dimension-title">${escapeHtml(item.name)}</div><div class="label">${escapeHtml(item.help)}</div></div><span class="pill teal">${item.max}分</span></div>
      <div class="dimension-body">
        <div class="band-grid">
          ${item.bands.map((band) => `<button type="button" class="band-option ${active === band ? "active" : ""}" data-action="choose-band" data-field="${item.key}" data-score="${band.max}"><span class="band-range">${band.min}-${band.max}</span><span class="band-label">${escapeHtml(band.label)}</span></button>`).join("")}
        </div>
        <div class="field-row"><label>具体分数</label><input type="number" min="0" max="${item.max}" value="${Number(value || 0)}" data-field="${item.key}" /></div>
      </div>
    </section>
  `;
}

function adminView() {
  const finished = state.summary.filter((item) => item.average != null).length;
  const avg = finished
    ? Math.round((state.summary.filter((item) => item.average != null).reduce((sum, item) => sum + item.average, 0) / finished) * 10) / 10
    : "-";
  return `
    <section class="topbar">
      <div><div class="eyebrow">管理端</div><h1>评分结果汇总</h1><p class="copy">这里汇总后端保存的评分结果；正式接入后，课题和评委关系来自飞书多维表格。</p></div>
      <button class="button ghost" data-action="refresh">刷新</button>
    </section>
    <section class="metrics">
      ${metric("课题数量", state.summary.length)}
      ${metric("已产生评分", finished)}
      ${metric("平均分", avg)}
      ${metric("优秀案例推荐", state.summary.reduce((sum, item) => sum + item.recommendationCount, 0))}
    </section>
    <section class="panel">
      <div class="panel-header"><div class="panel-title">课题汇总</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>课题</th><th>部门</th><th>类型</th><th>申请等级</th><th>进度</th><th>平均分</th><th>结果</th><th>推荐数</th></tr></thead>
          <tbody>
            ${state.summary.map((item) => {
              const grade = item.average == null ? { label: "待评分", className: "amber" } : gradeOf(item.average);
              return `<tr><td><strong>${escapeHtml(item.topic.title)}</strong><br><span class="label">${escapeHtml(item.topic.owner)}</span></td><td>${escapeHtml(item.topic.department)}</td><td>${escapeHtml(item.topic.type)}</td><td>${escapeHtml(item.topic.level)}</td><td>${item.scoredCount}/${item.requiredCount}</td><td>${item.average ?? "-"}</td><td><span class="pill ${grade.className}">${escapeHtml(item.grade)}</span></td><td>${item.recommendationCount}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function settingsView() {
  return `
    <section class="topbar"><div><div class="eyebrow">评分规则</div><h1>四维度评分细则</h1><p class="copy">权重固定：问题价值35分、使用深度25分、交付质量25分、可复用沉淀15分。</p></div></section>
    <section class="content-grid">
      <div class="panel"><div class="panel-header"><div class="panel-title">分值档位</div></div><div class="panel-body"><div class="rubric-list">${rubric.map((item) => `<div class="rubric-item"><div class="rubric-score">${escapeHtml(item.name)} · ${item.max}分</div><div class="rubric-text">${escapeHtml(item.help)}</div><div class="band-grid" style="margin-top:10px;">${item.bands.map((band) => `<div class="band-option"><span class="band-range">${band.min}-${band.max}</span><span class="band-label">${escapeHtml(band.label)}</span></div>`).join("")}</div></div>`).join("")}</div></div></div>
      <aside class="panel"><div class="panel-header"><div class="panel-title">等级规则</div></div><div class="panel-body"><div class="rubric-list"><div class="rubric-item"><div class="rubric-score">≥90 · A 优秀</div><div class="rubric-text">具备标杆示范价值</div></div><div class="rubric-item"><div class="rubric-score">80-89 · B 良好</div><div class="rubric-text">具备稳定AI项目交付能力</div></div><div class="rubric-item"><div class="rubric-score">70-79 · C 合格</div><div class="rubric-text">达到基本要求，有改进空间</div></div><div class="rubric-item"><div class="rubric-score">&lt;70 · 不合格</div><div class="rubric-text">需要辅导或补充材料</div></div></div></div></aside>
    </section>
  `;
}

function showToast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2200);
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "set-view") {
    state.view = target.dataset.view;
    state.selectedAssignmentId = "";
    state.form = {};
    render();
  }
  if (action === "open-score") {
    state.selectedAssignmentId = target.dataset.id;
    state.form = {};
    render();
  }
  if (action === "back") {
    state.selectedAssignmentId = "";
    state.form = {};
    render();
  }
  if (action === "choose-band") {
    state.form[target.dataset.field] = Number(target.dataset.score);
    render();
  }
  if (action === "refresh") {
    await refreshData();
    showToast("数据已刷新。");
  }
  if (action === "reset") {
    await api("/api/dev/reset", { method: "POST", body: "{}" });
    await refreshData();
    showToast("演示评分数据已重置。");
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!target.dataset.field) return;
  const field = target.dataset.field;
  if (target.type === "number") {
    const dimension = rubric.find((item) => item.key === field);
    state.form[field] = Math.max(0, Math.min(Number(target.value || 0), dimension.max));
  } else {
    state.form[field] = target.value;
  }
  render();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.field === "recommendCase") {
    state.form.recommendCase = target.value === "true";
    render();
  }
});

document.addEventListener("submit", async (event) => {
  if (!event.target.matches("[data-action='submit-score']")) return;
  event.preventDefault();
  if (!String(state.form.comment || "").trim()) {
    showToast("请填写综合评语。");
    return;
  }
  const payload = {
    ...state.form,
    reviewerId: state.user.user_id || state.user.open_id || state.user.name,
    reviewerUserId: state.user.user_id || "",
    reviewerOpenId: state.user.open_id || "",
    reviewerName: state.user.name,
  };
  await api("/api/scores", { method: "POST", body: JSON.stringify(payload) });
  await refreshData();
  state.selectedAssignmentId = "";
  state.form = {};
  showToast("评分已提交。");
});

boot();
