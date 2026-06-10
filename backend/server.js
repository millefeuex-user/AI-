const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const dataDir =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "ai-scoring-system")
    : path.join(rootDir, "backend", "data");
const scoreFile = path.join(dataDir, "scores.json");

const REVIEW_TYPE = {
  PEER: "互评",
  SUPERVISOR: "领导评分",
};

const REVIEW_IDENTITY = {
  PEER: "组内成员",
  SUPERVISOR: "领导",
};

const SCORE_GROUP_MEMBERS = {
  leader: ["郝里", "刘悦", "林博", "知行", "唐举", "楚川", "沈浪", "佩奇", "笑颜", "魏莱", "洪欣", "财神"],
  team: ["洛一", "晓戈", "平阳", "雨晴", "千里", "子泓"],
  td: ["沐风", "文澜", "青木", "云嵩", "星野", "翊鸿", "砚海", "冬阳", "蔚然", "唐瑞", "清风", "鲁旺", "叶成", "小满", "星遥", "浩克", "辰风", "波西", "晓戈", "丰仁", "时莱", "昭洋", "陆川", "王诚"],
  fi_px_sg: ["Renee", "紫苏", "林珏", "宸希", "团结", "姜维", "东东", "云舒", "朵拉", "子衿", "南星", "安澜"],
  oc_pd_ux: ["小雅", "庄周", "方遒", "文静", "燕青", "代代", "晴天", "舒言", "奕森", "高乐", "木槿", "元芳"],
  fc_hr_ad: ["鲁班", "佩兰", "摩卡", "轩辕", "苏木", "莉娜", "可妮", "松月", "紫竹", "悠米", "子叶"],
};

const GROUP_RULES = [
  {
    key: "leader",
    name: "Leader组",
    type: "leader",
    scoreGroupKey: "leader",
    scoreGroupName: "Leader组",
    env: "FEISHU_TABLE_LEADER",
    reviewers: { supervisors: ["林博", "陶白"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "team",
    name: "团队课题",
    type: "team",
    scoreGroupKey: "team",
    scoreGroupName: "团队课题",
    env: "FEISHU_TABLE_TEAM",
    tableId: "tblMOSVmTcxFlZMT",
    reviewers: { supervisors: ["林博"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "td",
    name: "TD",
    type: "normal",
    scoreGroupKey: "td",
    scoreGroupName: "TD",
    env: "FEISHU_TABLE_TD",
    reviewers: { supervisors: ["知行"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "pxgp",
    name: "PX+GP",
    type: "normal",
    scoreGroupKey: "fi_px_sg",
    scoreGroupName: "FI+PX+SG",
    env: "FEISHU_TABLE_PX_GP",
    reviewers: { supervisors: ["Louisa", "白起", "林博"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "sg",
    name: "SG",
    type: "normal",
    scoreGroupKey: "fi_px_sg",
    scoreGroupName: "FI+PX+SG",
    env: "FEISHU_TABLE_SG",
    reviewers: { supervisors: ["Louisa", "白起", "林博"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "fira",
    name: "FI+RA",
    type: "normal",
    scoreGroupKey: "fi_px_sg",
    scoreGroupName: "FI+PX+SG",
    env: "FEISHU_TABLE_FI_RA",
    reviewers: { supervisors: ["Louisa", "白起", "林博"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "pdux",
    name: "PD+UX",
    type: "normal",
    scoreGroupKey: "oc_pd_ux",
    scoreGroupName: "OC+PD+UX",
    env: "FEISHU_TABLE_PD_UX",
    reviewers: { supervisors: ["萧何", "唐举"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "oc",
    name: "OC",
    type: "normal",
    scoreGroupKey: "oc_pd_ux",
    scoreGroupName: "OC+PD+UX",
    env: "FEISHU_TABLE_OC",
    reviewers: { supervisors: ["萧何", "唐举"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "fc",
    name: "FC",
    type: "normal",
    scoreGroupKey: "fc_hr_ad",
    scoreGroupName: "FC+HR+AD",
    env: "FEISHU_TABLE_FC",
    reviewers: { supervisors: ["洪欣", "郝里", "林博"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
  {
    key: "hradmuxi",
    name: "HR+AD+木夕",
    type: "normal",
    scoreGroupKey: "fc_hr_ad",
    scoreGroupName: "FC+HR+AD",
    env: "FEISHU_TABLE_HR_AD_MUXI",
    reviewers: { supervisors: ["洪欣", "郝里", "林博"] },
    weights: { peer: 0.5, supervisor: 0.5 },
  },
];

const nodeEnv = process.env.NODE_ENV || "development";
const defaultMockMode = nodeEnv !== "production";

const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 5173),
  nodeEnv,
  mockMode:
    process.env.MOCK_MODE == null
      ? defaultMockMode
      : String(process.env.MOCK_MODE || "false") !== "false",
  feishu: {
    appId: process.env.FEISHU_APP_ID || "",
    appSecret: process.env.FEISHU_APP_SECRET || "",
    redirectUri: process.env.FEISHU_REDIRECT_URI || "",
    oauthScopes: process.env.FEISHU_OAUTH_SCOPES || "",
    appToken: process.env.FEISHU_APP_TOKEN || "",
    wikiToken: process.env.FEISHU_WIKI_TOKEN || "",
    resultAppToken: process.env.FEISHU_RESULT_APP_TOKEN || "",
    resultTableId: process.env.FEISHU_RESULT_TABLE_ID || "",
    sourceTables: Object.fromEntries(GROUP_RULES.map((rule) => [rule.key, process.env[rule.env] || ""])),
  },
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  cookieSecure:
    process.env.COOKIE_SECURE == null
      ? process.env.NODE_ENV === "production"
      : String(process.env.COOKIE_SECURE || "false") === "true",
  allowTenantTokenFallback: String(process.env.ALLOW_TENANT_TOKEN_FALLBACK || "false") === "true",
  fields: {
    resultId: process.env.RESULT_ID_FIELD || "评分ID",
    resultAssignmentId: process.env.RESULT_ASSIGNMENT_ID_FIELD || "关系ID",
    resultTopicId: process.env.RESULT_TOPIC_ID_FIELD || "课题ID",
    resultReviewerId: process.env.RESULT_REVIEWER_ID_FIELD || "评委UserID",
    resultReviewerName: process.env.RESULT_REVIEWER_NAME_FIELD || "花名 | 英文名",
    resultProjectScore: process.env.RESULT_PROJECT_SCORE_FIELD || "项目评分",
    resultReviewerIdentity: process.env.RESULT_REVIEWER_IDENTITY_FIELD || "评分人身份",
    resultTopicGroup: process.env.RESULT_TOPIC_GROUP_FIELD || "被评项目所在组",
    resultReviewType: process.env.RESULT_REVIEW_TYPE_FIELD || "评分类型",
    resultProblemValue: process.env.RESULT_PROBLEM_VALUE_FIELD || "问题价值",
    resultUsageDepth: process.env.RESULT_USAGE_DEPTH_FIELD || "使用深度",
    resultDeliveryQuality: process.env.RESULT_DELIVERY_QUALITY_FIELD || "交付质量",
    resultReuseAsset: process.env.RESULT_REUSE_ASSET_FIELD || "可复用沉淀",
    resultTotal: process.env.RESULT_TOTAL_FIELD || "总分",
    resultGrade: process.env.RESULT_GRADE_FIELD || "等级",
    resultComment: process.env.RESULT_COMMENT_FIELD || "备注",
    resultHighlights: process.env.RESULT_HIGHLIGHTS_FIELD || "主要亮点",
    resultSuggestions: process.env.RESULT_SUGGESTIONS_FIELD || "改进建议",
    resultRecommendCase: process.env.RESULT_RECOMMEND_CASE_FIELD || "是否推荐优秀案例",
    resultSubmittedAt: process.env.RESULT_SUBMITTED_AT_FIELD || "提交时间",
    writebackPeerAverage: process.env.WRITEBACK_PEER_AVERAGE_FIELD || "互评平均分",
    writebackSupervisorAverage: process.env.WRITEBACK_SUPERVISOR_AVERAGE_FIELD || "负责人平均分",
    writebackCommitteeAverage: process.env.WRITEBACK_COMMITTEE_AVERAGE_FIELD || "班委平均分",
    writebackSecondAverage: process.env.WRITEBACK_SECOND_AVERAGE_FIELD || "负责人/班委平均分",
    writebackFinalScore: process.env.WRITEBACK_FINAL_SCORE_FIELD || "最终总分",
    writebackFinalGrade: process.env.WRITEBACK_FINAL_GRADE_FIELD || "最终等级",
    writebackScoredCount: process.env.WRITEBACK_SCORED_COUNT_FIELD || "已评分人数",
    writebackStatus: process.env.WRITEBACK_STATUS_FIELD || "评分状态",
    writebackScoreDetail: process.env.WRITEBACK_SCORE_DETAIL_FIELD || "评分明细",
    writebackLastScoredAt: process.env.WRITEBACK_LAST_SCORED_AT_FIELD || "最后评分时间",
  },
};

let cachedBitableAppToken = "";
let cachedTenantAccessToken = "";
let cachedTenantAccessTokenExpiresAt = 0;
const fieldNameCache = new Map();
const userAccessTokens = new Map();
const sessions = new Map();
const oauthStates = new Map();
const SESSION_COOKIE = "ai_scoring_session";
const OAUTH_STATE_COOKIE = "ai_scoring_oauth_state";
const FEISHU_AUTH_MODE = {
  USER: "user",
  SERVICE: "service",
};

class AuthRequiredError extends Error {
  constructor(message = "Login required") {
    super(message);
    this.statusCode = 401;
  }
}

const mock = {
  sourceTopics: [
    { groupKey: "leader", owner: "郝里", title: "AI Funding Engine", department: "Leader组" },
    { groupKey: "leader", owner: "林博", title: "AI BOSS", department: "Leader组" },
    { groupKey: "team", owner: "@千里 | Cedric", title: "AI运营系统", department: "SG战略增长" },
    { groupKey: "team", owner: "@平阳 | Chrys", title: "战略资方管理系统", department: "战略合作" },
    { groupKey: "pxgp", owner: "Kaige", title: "平台合作项目全周期智能追踪", department: "GP全球合作" },
    { groupKey: "pxgp", owner: "林珏", title: "DOW3中后台管理系统", department: "GP全球合作" },
    { groupKey: "fc", owner: "鲁班", title: "AI凭证审核机器人", department: "FN财务" },
    { groupKey: "fc", owner: "佩兰", title: "AI融资项目管理引擎", department: "CM资本市场" },
  ],
};

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(scoreFile)) fs.writeFileSync(scoreFile, "[]", "utf8");
}

function readScores() {
  ensureStore();
  return JSON.parse(fs.readFileSync(scoreFile, "utf8") || "[]");
}

function writeScores(scores) {
  ensureStore();
  fs.writeFileSync(scoreFile, JSON.stringify(scores, null, 2), "utf8");
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json;charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        if (index < 0) return [item, ""];
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

function signValue(value) {
  return crypto.createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
}

function sessionKey() {
  return crypto.createHash("sha256").update(config.sessionSecret).digest();
}

function sealSessionPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey(), iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((item) => item.toString("base64url")).join(".");
}

function openSessionPayload(value) {
  try {
    const [ivPart, tagPart, encryptedPart] = String(value || "").split(".");
    if (!ivPart || !tagPart || !encryptedPart) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext);
  } catch (error) {
    return null;
  }
}

function getSession(req) {
  const raw = parseCookies(req)[SESSION_COOKIE] || "";
  const session = openSessionPayload(raw);
  if (session?.user && session.userAccessToken) return session;

  const [sessionId, signature] = raw.split(".");
  if (!sessionId || !signature || signValue(sessionId) !== signature) return null;
  return sessions.get(sessionId) || null;
}

function createSession(user, userAccessToken, refreshToken = "") {
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    user,
    userAccessToken,
    refreshToken,
    createdAt: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

function sessionCookie(session) {
  const value = sealSessionPayload({
    user: session.user,
    userAccessToken: session.userAccessToken,
    refreshToken: session.refreshToken || "",
    createdAt: session.createdAt,
  });
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    config.cookieSecure ? "Secure" : "",
    "Max-Age=2592000",
  ]
    .filter(Boolean)
    .join("; ");
}

function oauthStateCookie(record) {
  const value = sealSessionPayload(record);
  return [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    config.cookieSecure ? "Secure" : "",
    "Max-Age=600",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearCookie(name) {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    config.cookieSecure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

function publicUser(user) {
  const { _sessionUserAccessToken, ...safeUser } = user || {};
  return safeUser;
}

function userForSession(session) {
  if (!session?.user || !session.userAccessToken) throw new AuthRequiredError("请先完成飞书登录。");
  return { ...session.user, _sessionUserAccessToken: session.userAccessToken };
}

function requireUser(req) {
  const session = getSession(req);
  const user = userForSession(session);
  console.log(`[auth] 当前用户姓名: ${user.name || "未知"}`);
  return user;
}

function originFor(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

function oauthRedirectUri(req) {
  return config.feishu.redirectUri || `${originFor(req)}/auth/callback`;
}

function createOAuthState(req, returnTo = "/") {
  const record = {
    nonce: crypto.randomBytes(16).toString("base64url"),
    returnTo: returnTo.startsWith("/") ? returnTo : "/",
    redirectUri: oauthRedirectUri(req),
    createdAt: Date.now(),
  };
  const state = sealSessionPayload(record);
  record.state = state;
  oauthStates.set(state, record);
  return record;
}

function takeOAuthState(req, state) {
  let record = openSessionPayload(state);
  if (!record) {
    const cookieRecord = openSessionPayload(parseCookies(req)[OAUTH_STATE_COOKIE] || "");
    if (cookieRecord?.state === state) {
      record = cookieRecord;
    } else {
      record = oauthStates.get(state);
    }
  }
  if (record && !record.state) {
    record.state = state;
  }
  oauthStates.delete(state);
  if (!record?.state || record.state !== state || Date.now() - record.createdAt > 10 * 60 * 1000) return null;
  return record;
}
function buildFeishuAuthorizeUrl(req, state) {
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("client_id", config.feishu.appId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", oauthRedirectUri(req));
  url.searchParams.set("state", state);
  if (config.feishu.oauthScopes) url.searchParams.set("scope", config.feishu.oauthScopes);
  return url.toString();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function feishuFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Feishu returned non-JSON response: ${response.status} ${text.slice(0, 120)}`);
  }
  if (!response.ok || data.code) {
    throw new Error(data.msg || data.error_description || data.error || `Feishu request failed: ${response.status}`);
  }
  return data;
}

async function getTenantAccessToken() {
  if (cachedTenantAccessToken && Date.now() < cachedTenantAccessTokenExpiresAt) {
    return cachedTenantAccessToken;
  }
  const data = await feishuFetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: config.feishu.appId,
      app_secret: config.feishu.appSecret,
    }),
  });
  cachedTenantAccessToken = data.tenant_access_token || "";
  const expiresInMs = Math.max((Number(data.expire || data.expires_in || 0) - 60) * 1000, 60 * 1000);
  cachedTenantAccessTokenExpiresAt = Date.now() + expiresInMs;
  return cachedTenantAccessToken;
}

function userTokenKeys(user) {
  return [user?.user_id, user?.open_id, user?.name].map((item) => String(item || "").trim()).filter(Boolean);
}

function rememberUserAccessToken(user, token) {
  for (const key of userTokenKeys(user)) userAccessTokens.set(key, token);
}

function getUserAccessToken(user) {
  if (user?._sessionUserAccessToken) return user._sessionUserAccessToken;
  for (const key of userTokenKeys(user)) {
    const token = userAccessTokens.get(key);
    if (token) return token;
  }
  return "";
}

async function getAccessToken(user, authMode = FEISHU_AUTH_MODE.USER) {
  if (authMode === FEISHU_AUTH_MODE.SERVICE) {
    console.log("[feishu] 读表 token: tenant_access_token (service)");
    return getTenantAccessToken();
  }
  const userAccessToken = getUserAccessToken(user);
  if (userAccessToken) {
    console.log("[feishu] 读表 token: user_access_token");
    return userAccessToken;
  }
  if (!config.allowTenantTokenFallback) {
    console.log("[feishu] 读表 token: 缺少 user_access_token，已拒绝 fallback tenant_access_token");
    throw new AuthRequiredError("缺少飞书用户授权，请重新登录。");
  }
  console.log("[feishu] 读表 token: tenant_access_token");
  return getTenantAccessToken();
}

async function getBitableAppToken(user, authMode = FEISHU_AUTH_MODE.USER) {
  if (config.feishu.appToken) return config.feishu.appToken;
  if (cachedBitableAppToken) return cachedBitableAppToken;
  if (!config.feishu.wikiToken) throw new Error("Missing FEISHU_APP_TOKEN or FEISHU_WIKI_TOKEN");

  const accessToken = await getAccessToken(user, authMode);
  const data = await feishuFetch(
    `https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(config.feishu.wikiToken)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const node = data.data?.node || data.data || {};
  const objToken = node.obj_token || node.objToken;
  if (!objToken) throw new Error("Wiki node did not return obj_token. Please confirm this wiki link points to a bitable node.");
  cachedBitableAppToken = objToken;
  return cachedBitableAppToken;
}

async function loginByAuthCode(code, redirectUri) {
  console.log(`[auth] 是否拿到 code: ${Boolean(code)}`);
  if (!code) throw new AuthRequiredError("飞书 OAuth callback 缺少 code。");
  if (!config.feishu.appId || !config.feishu.appSecret) throw new Error("Missing FEISHU_APP_ID or FEISHU_APP_SECRET");
  let tokenData;
  try {
    tokenData = await feishuFetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.feishu.appId,
        client_secret: config.feishu.appSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
  } catch (error) {
    console.log("[auth] 换 token 成功: false");
    throw error;
  }
  const tokenPayload = tokenData.data || tokenData;
  const userAccessToken = tokenPayload.access_token || tokenPayload.user_access_token;
  if (!userAccessToken) throw new Error("Feishu OAuth token response did not include user_access_token.");
  console.log("[auth] 换 token 成功: true");
  const userData = await feishuFetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  const user = userData.data || userData;
  rememberUserAccessToken(user, userAccessToken);
  console.log(`[auth] 当前用户姓名: ${user.name || user.en_name || user.user_id || "未知"}`);
  return { user, userAccessToken, refreshToken: tokenPayload.refresh_token || "" };
}

function extractText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join("、");
  if (value.text) return String(value.text);
  if (value.name) return String(value.name);
  if (value.link) return String(value.link);
  if (value.url) return String(value.url);
  return String(value);
}

function pickField(fields, names) {
  for (const name of names) {
    const value = extractText(fields[name]);
    if (value) return value;
  }
  return "";
}

function pickNamedField(fields, names) {
  for (const name of names) {
    const value = extractText(fields[name]);
    if (value) return { name, value };
  }
  return { name: "", value: "" };
}

function normalizeFieldName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）【】\[\]<>《》:：/／\\|｜._-]/g, "");
}

function pickFieldByHint(fields, hints, excludes = []) {
  const normalizedHints = hints.map(normalizeFieldName).filter(Boolean);
  const normalizedExcludes = excludes.map(normalizeFieldName).filter(Boolean);
  for (const [name, value] of Object.entries(fields || {})) {
    const text = extractText(value);
    if (!text) continue;
    const normalizedName = normalizeFieldName(name);
    if (normalizedExcludes.some((item) => normalizedName.includes(item))) continue;
    if (normalizedHints.some((item) => normalizedName.includes(item))) {
      return text;
    }
  }
  return "";
}

function pickNamedFieldByHint(fields, hints, excludes = []) {
  const normalizedHints = hints.map(normalizeFieldName).filter(Boolean);
  const normalizedExcludes = excludes.map(normalizeFieldName).filter(Boolean);
  for (const [name, value] of Object.entries(fields || {})) {
    const text = extractText(value);
    if (!text) continue;
    const normalizedName = normalizeFieldName(name);
    if (normalizedExcludes.some((item) => normalizedName.includes(item))) continue;
    if (normalizedHints.some((item) => normalizedName.includes(item))) {
      return { name, value: text };
    }
  }
  return { name: "", value: "" };
}

function pickTopicTitle(fields, rule) {
  const title =
    pickField(fields, [
      "课题名称",
      "课题",
      "课题标题",
      "主题",
      "项目名称",
      "项目/课题名称",
      "项目主题",
      "AI课题名称",
      "AI课题",
      "名称",
    ]) ||
    pickFieldByHint(fields, ["课题名称", "项目名称", "课题", "项目", "标题", "主题", "名称"], [
      "花名",
      "负责人",
      "团队成员",
      "所在部门",
      "部门",
      "类型",
      "课题类型",
      "项目类型",
      "分类",
      "类别",
      "链接",
      "备注",
      "说明",
      "交付物",
    ]);

  if (title || rule.key !== "team") return title;

  for (const [name, value] of Object.entries(fields || {})) {
    const text = extractText(value);
    if (!text) continue;
    const normalizedName = normalizeFieldName(name);
    if (
      normalizedName.includes("负责人") ||
      normalizedName.includes("花名") ||
      normalizedName.includes("团队成员") ||
      normalizedName.includes("所在部门") ||
      normalizedName === "部门" ||
      normalizedName.includes("类型") ||
      normalizedName.includes("分类") ||
      normalizedName.includes("类别") ||
      normalizedName.includes("链接") ||
      normalizedName.includes("备注") ||
      normalizedName.includes("说明") ||
      normalizedName.includes("交付物")
    ) {
      continue;
    }
    return text;
  }

  return "";
}

function firstFilledField(fields) {
  for (const [name, value] of Object.entries(fields || {})) {
    if (["负责人意见", "意见", "审批意见", "审核意见"].includes(name)) continue;
    const text = extractText(value);
    if (text) return { name, value: text };
  }
  return { name: "", value: "" };
}

function ownerFieldForRule(fields, rule) {
  const firstField = firstFilledField(fields);
  const useAliasColumn = rule.key === "leader" || rule.key === "pxgp" || rule.key === "oc";
  const preferredNames = useAliasColumn
    ? ["花名", "花名 | 英文名", "花名｜英文名", "花名英文名"]
    : ["负责人", "项目负责人", "课题负责人"];
  const exact = pickNamedField(fields, preferredNames);
  if (exact.value) return exact;

  const hinted = pickNamedFieldByHint(fields, useAliasColumn ? ["花名"] : ["负责人"], [
    "负责人意见",
    "审批意见",
    "审核意见",
  ]);
  if (hinted.value) return hinted;

  return firstField;
}

function pickDepartment(fields) {
  return (
    pickField(fields, ["所在部门", "所在部门（多选）", "员工所在部门", "部门", "所属部门"]) ||
    pickFieldByHint(fields, ["所在部门", "员工所在部门", "部门", "所属部门"], [
      "负责人",
      "花名",
      "课题",
      "项目",
      "类型",
      "链接",
    ])
  );
}

function pickTopicType(fields, rule) {
  const sourceType =
    pickField(fields, ["类型", "课题类型", "项目类型", "分类", "类别"]) ||
    pickFieldByHint(fields, ["课题类型", "项目类型", "类型", "分类", "类别"], [
      "负责人",
      "花名",
      "所在部门",
      "部门",
      "课题名称",
      "项目名称",
      "链接",
    ]);
  if (sourceType) return sourceType;
  if (rule.type === "team") return "团队课题";
  if (rule.type === "leader") return "Leader组";
  return "普通个人组";
}

function normalizeRecordFields(fields) {
  return Object.entries(fields || {})
    .map(([name, value]) => ({ name, value: extractText(value) }))
    .filter((field) => field.name && field.value);
}

function normalizePersonToken(value) {
  return extractText(value)
    .replaceAll("@", "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryPersonToken(value) {
  const raw = normalizePersonToken(value);
  if (!raw) return "";
  const [first] = raw
    .split(/[|｜、,，/／;；\n]+/)
    .map(normalizePersonToken)
    .filter(Boolean);
  return first || raw;
}

function comparablePersonToken(value) {
  return normalizePersonToken(value)
    .toLowerCase()
    .replace(/[\s"'`·._-]/g, "");
}

function personAliases(value) {
  const raw = normalizePersonToken(value);
  if (!raw) return [];
  const candidates = new Set([raw]);
  raw
    .split(/[|｜、,，/／;；\n]+/)
    .map(normalizePersonToken)
    .filter(Boolean)
    .forEach((item) => candidates.add(item));
  const chineseNames = raw.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  chineseNames.forEach((item) => candidates.add(item));
  return [...candidates].map(comparablePersonToken).filter(Boolean);
}

function personMatches(left, right) {
  const leftAliases = personAliases(left);
  const rightAliases = personAliases(right);
  return leftAliases.some((a) =>
    rightAliases.some((b) => a === b || (a.length > 1 && b.length > 1 && (a.includes(b) || b.includes(a)))),
  );
}

function ruleFor(key) {
  return GROUP_RULES.find((rule) => rule.key === key);
}

function tableIdForRule(rule) {
  return rule?.tableId || config.feishu.sourceTables[rule?.key] || "";
}

function gradeOf(score) {
  if (score >= 90) return "A 优秀";
  if (score >= 80) return "B 良好";
  if (score >= 70) return "C 合格";
  return "不合格";
}

function normalizeSourceTopic(record, rule, index) {
  const fields = record.fields || {};
  const ownerField = ownerFieldForRule(fields, rule);
  const isTeamLikeTopic = rule.type === "leader" || rule.type === "team";
  const ownerSource = ownerField.value;
  const leader = isTeamLikeTopic ? primaryPersonToken(ownerSource) : "";
  const owner = isTeamLikeTopic ? leader || ownerSource : ownerSource;
  const title = pickTopicTitle(fields, rule);
  const department = pickDepartment(fields);
  const topicType = pickTopicType(fields, rule);
  const painPoint = pickField(fields, [
    "当前痛点/现状（描述耗时点 、易错点 、业务瓶颈等）",
    "当前痛点/现状",
    "当前痛点",
    "原流程痛点",
    "内容",
  ]);
  const expectedResult = pickField(fields, [
    "预期达成效果（可量化/可验证的数字/成果目标，请分条列述）",
    "预期达成效果",
    "预期效果",
    "效果说明",
  ]);
  const delivery = pickField(fields, ["交付物", "交付物成果", "核心交付成果"]);
  const materialUrl = pickField(fields, ["交付物链接", "成果介绍（按照模板要求提交）", "材料链接", "产品链接", "Demo链接"]);
  const productUrl = pickField(fields, ["产品预览链接", "产品链接", "Demo链接", "演示链接"]) || materialUrl;
  const remark = pickField(fields, ["备注", "说明"]);
  const detailFields = normalizeRecordFields(fields);
  if (!owner || !title) return null;
  return {
    id: `${rule.key}:${record.record_id || index}`,
    rawId: record.record_id || String(index),
    recordId: record.record_id || "",
    sourceTableId: rule.tableId || "",
    groupKey: rule.key,
    groupName: rule.name,
    groupType: rule.type,
    scoreGroupKey: rule.scoreGroupKey,
    scoreGroupName: rule.scoreGroupName,
    title,
    type: topicType,
    owner,
    ownerRaw: ownerSource,
    leader,
    leaderField: ownerField.name,
    department,
    level: rule.scoreGroupName,
    materialUrl,
    productUrl,
    summary: painPoint || expectedResult || delivery || remark,
    expectedResult,
    delivery,
    remark,
    detailFields,
  };
}

function normalizeMockTopic(item, index) {
  const rule = ruleFor(item.groupKey);
  return normalizeSourceTopic(
    {
      record_id: `mock_${index + 1}`,
      fields: {
        负责人: item.owner,
        课题名称: item.title,
        所在部门: item.department,
        "当前痛点/现状（描述耗时点 、易错点 、业务瓶颈等）": "本条为演示数据，用于验证固定评分规则。",
      },
    },
    { ...rule, tableId: "" },
    index,
  );
}

function requireSourceConfig() {
  if (config.mockMode) return;
  if (!config.feishu.appId || !config.feishu.appSecret) {
    throw new Error("真实数据模式缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET，无法使用服务权限读取课题表。");
  }
  if (!config.feishu.appToken && !config.feishu.wikiToken) {
    throw new Error("真实数据模式缺少 FEISHU_APP_TOKEN 或 FEISHU_WIKI_TOKEN，无法读取课题统计表。");
  }
}

function sourceTopicRejectReason(record, rule) {
  const fields = record.fields || {};
  const owner = ownerFieldForRule(fields, rule).value;
  const title = pickTopicTitle(fields, rule);
  if (!owner && !title) return "缺少负责人/组长字段和课题名称字段";
  if (!owner) return "缺少负责人/组长字段";
  if (!title) return "缺少课题名称字段";
  return "";
}

async function listBitableRecords(tableId, user, appTokenOverride = "", authMode = FEISHU_AUTH_MODE.SERVICE) {
  const accessToken = await getAccessToken(user, authMode);
  const appToken = appTokenOverride || (await getBitableAppToken(user, authMode));
  const items = [];
  let pageToken = "";
  do {
    const tokenPart = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "";
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500${tokenPart}`;
    const data = await feishuFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    items.push(...(data.data?.items || []));
    pageToken = data.data?.page_token || "";
  } while (pageToken);
  return items;
}

async function writeBitableRecord(tableId, recordId, fields, user, appTokenOverride = "", authMode = FEISHU_AUTH_MODE.SERVICE) {
  const accessToken = await getAccessToken(user, authMode);
  const appToken = appTokenOverride || (await getBitableAppToken(user, authMode));
  const filteredFields = await filterWritableFields(tableId, fields, user, appTokenOverride, authMode);
  if (!Object.keys(filteredFields).length) return null;
  const url = recordId
    ? `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`
    : `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
  const data = await feishuFetch(url, {
    method: recordId ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: filteredFields }),
  });
  return data.data?.record || data.data;
}

async function listBitableFields(tableId, user, appTokenOverride = "", authMode = FEISHU_AUTH_MODE.SERVICE) {
  const accessToken = await getAccessToken(user, authMode);
  const appToken = appTokenOverride || (await getBitableAppToken(user, authMode));
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=200`;
  const data = await feishuFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  return data.data?.items || [];
}

async function getFieldNames(tableId, user, appTokenOverride = "", authMode = FEISHU_AUTH_MODE.SERVICE) {
  const cacheKey = `${authMode}:${appTokenOverride || "default"}:${tableId}`;
  if (fieldNameCache.has(cacheKey)) return fieldNameCache.get(cacheKey);
  const fields = await listBitableFields(tableId, user, appTokenOverride, authMode);
  const names = new Set(fields.map((field) => field.field_name).filter(Boolean));
  fieldNameCache.set(cacheKey, names);
  return names;
}

async function filterWritableFields(tableId, fields, user, appTokenOverride = "", authMode = FEISHU_AUTH_MODE.SERVICE) {
  const fieldNames = await getFieldNames(tableId, user, appTokenOverride, authMode);
  return Object.fromEntries(Object.entries(fields).filter(([name]) => fieldNames.has(name)));
}

async function getTopics(user) {
  if (config.mockMode) {
    return mock.sourceTopics.map(normalizeMockTopic).filter(Boolean);
  }
  requireSourceConfig();

  const tasks = GROUP_RULES.map(async (rule) => {
    const tableId = tableIdForRule(rule);
    if (!tableId) return [];
    try {
      const records = await listBitableRecords(tableId, user);
      return records
        .map((record, index) => normalizeSourceTopic(record, { ...rule, tableId }, index))
        .filter(Boolean);
    } catch (error) {
      console.error(`[feishu] 读取子表失败，已跳过: ${rule.name} (${tableId}) - ${error.message}`);
      return [];
    }
  });

  const topicGroups = await Promise.all(tasks);
  return topicGroups.flat();
}

async function getTopicDiagnostics(user) {
  if (config.mockMode) {
    return {
      mode: "mock",
      total: mock.sourceTopics.length,
      groups: GROUP_RULES.map((rule) => ({
        key: rule.key,
        name: rule.name,
        configured: false,
        rawCount: mock.sourceTopics.filter((topic) => topic.groupKey === rule.key).length,
        recognizedCount: mock.sourceTopics.map(normalizeMockTopic).filter((topic) => topic?.groupKey === rule.key).length,
        skipped: [],
      })),
    };
  }
  requireSourceConfig();

  const groups = [];
  for (const rule of GROUP_RULES) {
    const tableId = tableIdForRule(rule);
    if (!tableId) {
      groups.push({
        key: rule.key,
        name: rule.name,
        configured: false,
        rawCount: 0,
        recognizedCount: 0,
        skipped: [],
        error: `${rule.env} 未配置`,
      });
      continue;
    }
    try {
      const records = await listBitableRecords(tableId, user);
      const normalized = records.map((record, index) => normalizeSourceTopic(record, { ...rule, tableId }, index));
      groups.push({
        key: rule.key,
        name: rule.name,
        tableId,
        configured: true,
        rawCount: records.length,
        recognizedCount: normalized.filter(Boolean).length,
        recognizedRecords: normalized
          .filter(Boolean)
          .map((topic) => ({
            recordId: topic.recordId,
            ownerField: topic.leaderField,
            owner: topic.owner,
            title: topic.title,
            department: topic.department,
            type: topic.type,
          })),
        skipped: records
          .map((record, index) => ({
            recordId: record.record_id || String(index),
            reason: normalized[index] ? "" : sourceTopicRejectReason(record, rule),
            fields: Object.keys(record.fields || {}),
          }))
          .filter((item) => item.reason),
      });
    } catch (error) {
      groups.push({
        key: rule.key,
        name: rule.name,
        tableId,
        configured: true,
        rawCount: 0,
        recognizedCount: 0,
        skipped: [],
        error: error.message,
      });
    }
  }
  return {
    mode: "feishu",
    total: groups.reduce((sum, group) => sum + group.recognizedCount, 0),
    groups,
  };
}

function normalizeScore(record) {
  const fields = record.fields || {};
  const projectScore = Number(extractText(fields[config.fields.resultProjectScore]) || 0);
  return {
    id: extractText(fields[config.fields.resultId]) || record.record_id,
    recordId: record.record_id,
    assignmentId: extractText(fields[config.fields.resultAssignmentId]),
    topicId: extractText(fields[config.fields.resultTopicId]),
    reviewerId: extractText(fields[config.fields.resultReviewerId]),
    reviewerName: extractText(fields[config.fields.resultReviewerName]),
    reviewerIdentity: extractText(fields[config.fields.resultReviewerIdentity]),
    topicGroup: extractText(fields[config.fields.resultTopicGroup]),
    reviewType: extractText(fields[config.fields.resultReviewType]),
    problemValue: Number(extractText(fields[config.fields.resultProblemValue]) || 0),
    usageDepth: Number(extractText(fields[config.fields.resultUsageDepth]) || 0),
    deliveryQuality: Number(extractText(fields[config.fields.resultDeliveryQuality]) || 0),
    reuseAsset: Number(extractText(fields[config.fields.resultReuseAsset]) || 0),
    total: Number(extractText(fields[config.fields.resultTotal]) || projectScore || 0),
    grade: extractText(fields[config.fields.resultGrade]),
    comment: extractText(fields[config.fields.resultComment]),
    highlights: extractText(fields[config.fields.resultHighlights]),
    suggestions: extractText(fields[config.fields.resultSuggestions]),
    recommendCase: ["是", "true", "TRUE", "1"].includes(extractText(fields[config.fields.resultRecommendCase])),
    submittedAt: extractText(fields[config.fields.resultSubmittedAt]),
  };
}

async function getScores(user) {
  if (
    config.mockMode ||
    !config.feishu.resultTableId ||
    (!config.feishu.appToken && !config.feishu.wikiToken && !config.feishu.resultAppToken)
  ) {
    return readScores();
  }
  const records = await listBitableRecords(config.feishu.resultTableId, user, config.feishu.resultAppToken);
  return records.map(normalizeScore);
}

function scoreRemark(score) {
  return [
    `课题：${score.topicTitle || score.topicId || "-"}`,
    `评分类型：${score.reviewType || "-"}`,
    `问题价值：${score.problemValue}`,
    `使用深度：${score.usageDepth}`,
    `交付质量：${score.deliveryQuality}`,
    `可复用沉淀：${score.reuseAsset}`,
    score.comment ? `综合评语：${score.comment}` : "",
    score.highlights ? `主要亮点：${score.highlights}` : "",
    score.suggestions ? `改进建议：${score.suggestions}` : "",
    score.recommendCase ? "推荐优秀案例：是" : "推荐优秀案例：否",
    `提交时间：${score.submittedAt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function scoreToBitableFields(score) {
  return {
    [config.fields.resultReviewerName]: score.reviewerName,
    [config.fields.resultProjectScore]: score.total,
    [config.fields.resultGrade]: score.grade,
    [config.fields.resultComment]: scoreRemark(score),
  };
}

async function saveScore(score, user) {
  if (
    config.mockMode ||
    !config.feishu.resultTableId ||
    (!config.feishu.appToken && !config.feishu.wikiToken && !config.feishu.resultAppToken)
  ) {
    const scores = readScores();
    const index = scores.findIndex((item) => item.assignmentId === score.assignmentId && item.reviewerId === score.reviewerId);
    if (index >= 0) scores[index] = score;
    else scores.push(score);
    writeScores(scores);
    return score;
  }

  const existingScores = await getScores(user);
  const existing = existingScores.find((item) => personMatches(item.reviewerName, score.reviewerName));
  const nextScore = { ...score, id: existing?.id || score.id, recordId: existing?.recordId };
  await writeBitableRecord(
    config.feishu.resultTableId,
    nextScore.recordId,
    scoreToBitableFields(nextScore),
    user,
    config.feishu.resultAppToken,
  );
  return nextScore;
}

function assignmentIdFor(topic, reviewerKey, reviewType) {
  return `${topic.id}:${reviewType}:${reviewerKey}`;
}

function reviewerKey(user) {
  return user.user_id || user.open_id || user.name || "anonymous";
}

function isSupervisorForRule(user, rule) {
  return (rule.reviewers.supervisors || []).some((name) => personMatches(user.name, name));
}

function groupMembers(topics, scoreGroupKey) {
  const configuredMembers = SCORE_GROUP_MEMBERS[scoreGroupKey] || [];
  if (configuredMembers.length) return configuredMembers;
  return topics.filter((topic) => topic.scoreGroupKey === scoreGroupKey).map((topic) => topic.leader || topic.owner);
}

function reviewIdentityFor(reviewType) {
  if (reviewType === REVIEW_TYPE.SUPERVISOR) return REVIEW_IDENTITY.SUPERVISOR;
  return REVIEW_IDENTITY.PEER;
}

function buildAssignment(topic, user, reviewType, scores) {
  const key = reviewerKey(user);
  const assignmentId = assignmentIdFor(topic, key, reviewType);
  const score = scores.find((item) => item.assignmentId === assignmentId && item.reviewerId === key);
  return {
    id: assignmentId,
    topicId: topic.id,
    reviewerId: key,
    reviewerName: user.name,
    reviewerIdentity: reviewIdentityFor(reviewType),
    reviewType,
    required: true,
    topic,
    score,
  };
}

function buildAssignmentsForUser(user, topics, scores) {
  const assignments = [];
  const add = (topic, reviewType) => {
    const assignment = buildAssignment(topic, user, reviewType, scores);
    const exists = assignments.some((item) => item.id === assignment.id);
    if (!exists) assignments.push(assignment);
  };

  for (const topic of topics) {
    const rule = ruleFor(topic.groupKey);
    if (!rule) continue;
    const members = groupMembers(topics, topic.scoreGroupKey);
    const isGroupMember = members.some((member) => personMatches(user.name, member));
    const isOwner = personMatches(user.name, topic.leader || topic.owner);

    if (isGroupMember && !isOwner) {
      add(topic, REVIEW_TYPE.PEER);
    }

    if (isSupervisorForRule(user, rule)) {
      add(topic, REVIEW_TYPE.SUPERVISOR);
    }
  }
  return assignments;
}

function average(scores) {
  const validScores = scores.filter((item) => Number.isFinite(Number(item.total)));
  if (!validScores.length) return null;
  return Math.round((validScores.reduce((sum, item) => sum + Number(item.total), 0) / validScores.length) * 10) / 10;
}

function requiredCounts(topic, topics) {
  const rule = ruleFor(topic.groupKey);
  const peerCount = Math.max(groupMembers(topics, topic.scoreGroupKey).length - 1, 0);
  if (!rule) return { peer: 0, supervisor: 0, total: 0 };
  const supervisorCount = (rule.reviewers.supervisors || []).length;
  return { peer: peerCount, supervisor: supervisorCount, total: peerCount + supervisorCount };
}

function summarizeTopic(topic, topics, scores) {
  const rule = ruleFor(topic.groupKey);
  const topicScores = scores.filter((score) => score.topicId === topic.id);
  const peerAverage = average(topicScores.filter((score) => score.reviewType === REVIEW_TYPE.PEER));
  const supervisorAverage = average(topicScores.filter((score) => score.reviewType === REVIEW_TYPE.SUPERVISOR));
  let finalScore = null;
  if (peerAverage != null && supervisorAverage != null) {
    finalScore = Math.round((peerAverage * rule.weights.peer + supervisorAverage * rule.weights.supervisor) * 10) / 10;
  }
  const counts = requiredCounts(topic, topics);
  return {
    topic,
    requiredCount: counts.total,
    scoredCount: topicScores.length,
    peerAverage,
    supervisorAverage,
    average: finalScore,
    grade: finalScore == null ? "评分中" : gradeOf(finalScore),
    recommendationCount: topicScores.filter((score) => score.recommendCase).length,
    scores: topicScores,
  };
}

function upsertScore(scores, score) {
  const nextScores = [...scores];
  const index = nextScores.findIndex((item) => item.assignmentId === score.assignmentId && item.reviewerId === score.reviewerId);
  if (index >= 0) nextScores[index] = score;
  else nextScores.push(score);
  return nextScores;
}

function formatScoreDetails(scores) {
  if (!scores.length) return "";
  return scores
    .slice()
    .sort((a, b) => String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")))
    .map((score) => {
      const reviewer = score.reviewerName || score.reviewerId || "未知评分人";
      const identity = score.reviewerIdentity || reviewIdentityFor(score.reviewType);
      return [
        `${reviewer}（${identity}/${score.reviewType}）`,
        `总分:${score.total}`,
        `问题价值:${score.problemValue}`,
        `使用深度:${score.usageDepth}`,
        `交付质量:${score.deliveryQuality}`,
        `可复用沉淀:${score.reuseAsset}`,
        score.comment ? `评语:${score.comment}` : "",
      ]
        .filter(Boolean)
        .join("；");
    })
    .join("\n");
}

function topicWritebackFields(summary) {
  const secondAverage = summary.supervisorAverage;
  const fields = {
    [config.fields.writebackPeerAverage]: summary.peerAverage,
    [config.fields.writebackSupervisorAverage]: summary.supervisorAverage,
    [config.fields.writebackSecondAverage]: secondAverage,
    [config.fields.writebackFinalScore]: summary.average,
    [config.fields.writebackFinalGrade]: summary.grade,
    [config.fields.writebackScoredCount]: summary.scoredCount,
    [config.fields.writebackStatus]: summary.average == null ? "评分中" : "已完成",
    [config.fields.writebackScoreDetail]: formatScoreDetails(summary.scores || []),
    [config.fields.writebackLastScoredAt]: new Date().toISOString(),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null && value !== undefined));
}

async function writeBackTopicSummary(topic, summary, user) {
  if (config.mockMode || (!config.feishu.appToken && !config.feishu.wikiToken)) return;
  if (!topic.sourceTableId || !topic.recordId) return;
  await writeBitableRecord(topic.sourceTableId, topic.recordId, topicWritebackFields(summary), user);
}

async function routeApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      service: "ai-scoring-system",
      mockMode: config.mockMode,
      nodeEnv: config.nodeEnv,
      hasAppId: Boolean(config.feishu.appId),
      hasRedirectUri: Boolean(config.feishu.redirectUri),
      hasWikiToken: Boolean(config.feishu.wikiToken),
      hasAppToken: Boolean(config.feishu.appToken),
      hasResultAppToken: Boolean(config.feishu.resultAppToken),
      sourceMode: config.mockMode ? "mock" : "feishu",
      configuredSourceTables: Object.fromEntries(
        GROUP_RULES.map((rule) => [rule.key, Boolean(tableIdForRule(rule))]),
      ),
      scoreStore: scoreFile,
      startedAt: process.uptime(),
    });
  }

  if (req.method === "GET" && pathname === "/api/config") {
    return json(res, 200, {
      mockMode: config.mockMode,
      appId: config.feishu.appId,
      oauthScopes: config.feishu.oauthScopes,
      hasWikiToken: Boolean(config.feishu.wikiToken),
      ruleMode: "fixed-group-rule",
      sourceMode: config.mockMode ? "mock" : "feishu",
    });
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const session = getSession(req);
    if (!session?.user || !session.userAccessToken) return json(res, 401, { error: "未登录飞书账号。" });
    console.log(`[auth] 当前用户姓名: ${session.user.name || "未知"}`);
    return json(res, 200, { user: publicUser(session.user) });
  }

  if (req.method === "GET" && pathname === "/api/auth/feishu/authorize") {
    if (!config.feishu.appId) return json(res, 500, { error: "Missing FEISHU_APP_ID" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const stateRecord = createOAuthState(req, url.searchParams.get("returnTo") || "/");
    return json(res, 200, {
      state: stateRecord.state,
      authorizationUrl: buildFeishuAuthorizeUrl(req, stateRecord.state),
      redirectUri: oauthRedirectUri(req),
    }, { "Set-Cookie": oauthStateCookie(stateRecord) });
  }

  if (req.method === "POST" && pathname === "/api/auth/feishu/callback") {
    const body = await parseBody(req);
    const stateRecord = takeOAuthState(req, String(body.state || ""));
    if (!stateRecord) return json(res, 401, { error: "OAuth state 校验失败，请重新登录。" });
    const { user, userAccessToken, refreshToken } = await loginByAuthCode(body.code, stateRecord.redirectUri);
    const session = createSession(user, userAccessToken, refreshToken);
    return json(res, 200, { user: publicUser(user), returnTo: stateRecord.returnTo }, {
      "Set-Cookie": [sessionCookie(session), clearCookie(OAUTH_STATE_COOKIE)],
    });
  }

  if (req.method === "GET" && pathname === "/api/rules") {
    return json(res, 200, { groupRules: GROUP_RULES });
  }

  if (req.method === "GET" && pathname === "/api/topics") {
    const user = requireUser(req);
    const topics = await getTopics(user);
    return json(res, 200, { topics });
  }

  if (req.method === "GET" && pathname === "/api/debug/fields") {
    const output = {};
    for (const rule of GROUP_RULES) {
      const tableId = tableIdForRule(rule);
      if (!tableId) {
        output[rule.key] = { name: rule.name, tableId, fields: [], error: "table_id not configured" };
        continue;
      }
      const user = requireUser(req);
      const fields = await listBitableFields(tableId, user);
      output[rule.key] = {
        name: rule.name,
        tableId,
        fields: fields.map((field) => ({ fieldId: field.field_id, fieldName: field.field_name, type: field.type })),
      };
    }
    return json(res, 200, output);
  }

  if (req.method === "GET" && pathname === "/api/debug/topics") {
    const user = requireUser(req);
    const diagnostics = await getTopicDiagnostics(user);
    return json(res, 200, diagnostics);
  }

  if (req.method === "GET" && pathname === "/api/assignments/me") {
    const user = requireUser(req);
    const [topics, scores] = await Promise.all([getTopics(user), getScores(user)]);
    const assignments = buildAssignmentsForUser(user, topics, scores);
    return json(res, 200, { assignments });
  }

  if (req.method === "POST" && pathname === "/api/scores") {
    const body = await parseBody(req);
    const user = requireUser(req);
    const [topics, scores] = await Promise.all([getTopics(user), getScores(user)]);
    const topic = topics.find((item) => item.id === body.topicId);
    const existing = scores.find((item) => item.assignmentId === body.assignmentId && item.reviewerId === body.reviewerId);
    const total = Number(body.problemValue || 0) + Number(body.usageDepth || 0) + Number(body.deliveryQuality || 0) + Number(body.reuseAsset || 0);
    const score = {
      id: existing?.id || body.id || crypto.randomUUID(),
      recordId: existing?.recordId,
      assignmentId: body.assignmentId,
      topicId: body.topicId,
      topicTitle: topic?.title || "",
      reviewerId: reviewerKey(user),
      reviewerName: user.name,
      reviewerIdentity: body.reviewerIdentity || reviewIdentityFor(body.reviewType),
      topicGroup: topic?.groupName || topic?.groupKey || "",
      reviewType: body.reviewType,
      problemValue: Number(body.problemValue || 0),
      usageDepth: Number(body.usageDepth || 0),
      deliveryQuality: Number(body.deliveryQuality || 0),
      reuseAsset: Number(body.reuseAsset || 0),
      total,
      grade: gradeOf(total),
      comment: body.comment || "",
      highlights: body.highlights || "",
      suggestions: body.suggestions || "",
      recommendCase: Boolean(body.recommendCase),
      submittedAt: new Date().toISOString(),
    };
    const savedScore = await saveScore(score, user);
    if (topic) {
      const nextScores = upsertScore(scores, savedScore);
      const summary = summarizeTopic(topic, topics, nextScores);
      await writeBackTopicSummary(topic, summary, user);
    }
    return json(res, 200, { score: savedScore });
  }

  if (req.method === "GET" && pathname === "/api/admin/summary") {
    const user = requireUser(req);
    const [topics, scores] = await Promise.all([getTopics(user), getScores(user)]);
    const summary = topics.map((topic) => summarizeTopic(topic, topics, scores));
    return json(res, 200, { summary });
  }

  if (req.method === "POST" && pathname === "/api/dev/reset") {
    if (!config.mockMode) return json(res, 400, { error: "Reset is only available in mock mode." });
    writeScores([]);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: "API not found" });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(frontendDir, safePath));
  if (!filePath.startsWith(frontendDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(frontendDir, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await routeApi(req, res, url.pathname);
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, error.statusCode || 500, { error: error.message });
  }
}

if (config.nodeEnv === "production" && !process.env.SESSION_SECRET) {
  console.warn("[config] NODE_ENV=production 时建议设置固定 SESSION_SECRET，否则重启后登录态会失效。");
}

if (require.main === module) {
  const server = http.createServer(handleRequest);
  server.listen(config.port, config.host, () => {
    console.log(`AI Scoring System running at http://${config.host}:${config.port}`);
    console.log(`MOCK_MODE=${config.mockMode}`);
    console.log(`NODE_ENV=${config.nodeEnv}`);
    console.log(`COOKIE_SECURE=${config.cookieSecure}`);
  });
}

module.exports = { handleRequest };
