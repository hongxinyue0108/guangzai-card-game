const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const DB_FILE = path.join(__dirname, "db.json");
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
loadEnv(path.join(ROOT_DIR, ".env"));
loadEnv(path.join(__dirname, ".env"));
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const MAX_DRAW_CHANCES = 15;
const DRAW_RECOVERY_INTERVAL_MS = 30 * 60 * 1000;

const SERIES = ["竞技高光", "冥场面", "社区梗", "经典瞬间"];
const NPC_RANKING = [
  { nickname: "高光猎人", score: 680, collected: 12 },
  { nickname: "服务器守夜人", score: 520, collected: 10 },
  { nickname: "下次一定本尊", score: 360, collected: 8 },
  { nickname: "冥场面收藏家", score: 260, collected: 6 },
  { nickname: "新手村夕阳", score: 120, collected: 4 }
];
const RARITIES = {
  normal: { name: "普通", weight: 58, score: 10, fragment: 2, price: 12 },
  rare: { name: "稀有", weight: 27, score: 30, fragment: 6, price: 28 },
  epic: { name: "史诗", weight: 11, score: 80, fragment: 16, price: 70 },
  legend: { name: "传说", weight: 3.5, score: 180, fragment: 36, price: 160 },
  hidden: { name: "隐藏款", weight: 0.5, score: 400, fragment: 80, price: 360 }
};

const CARDS = [
  ["c001", "丝血反杀", "竞技高光", "legend", "这波不亏，直接起飞！"],
  ["c002", "绝地翻盘", "竞技高光", "epic", "胜负从来不到最后一秒不算数。"],
  ["c003", "五杀时刻", "竞技高光", "legend", "全场沉默，只剩击败提示在响。"],
  ["c004", "极限抢龙", "竞技高光", "epic", "手比脑子快，龙比对面先没。"],
  ["c005", "闪现撞墙", "冥场面", "normal", "不是墙太硬，是梦想太近。"],
  ["c006", "人体描边", "冥场面", "normal", "每一枪都很真诚，只是敌人不配合。"],
  ["c007", "落地成盒", "冥场面", "rare", "天空很美，盒子很快。"],
  ["c008", "技能全空", "冥场面", "normal", "操作拉满，命中为零。"],
  ["c009", "策划道歉信", "社区梗", "rare", "字越多，事情越大。"],
  ["c010", "服务器维护", "社区梗", "normal", "不是你网卡，是宇宙在重启。"],
  ["c011", "下次一定", "社区梗", "normal", "最强承诺，最弱执行。"],
  ["c012", "全服补偿", "社区梗", "epic", "真正的节日，是邮箱亮起来。"],
  ["c013", "新手村夕阳", "经典瞬间", "rare", "第一次出发时，天色总是很好。"],
  ["c014", "最后一战", "经典瞬间", "legend", "故事结束前，总要有人站出来。"],
  ["c015", "好友列表变灰", "经典瞬间", "epic", "有些名字还在，只是不再上线。"],
  ["c016", "名场面之柱", "经典瞬间", "hidden", "所有玩家共同刻下的一瞬间。"]
].map(([id, name, series, rarity, quote]) => ({
  id,
  name,
  series,
  rarity,
  rarityName: RARITIES[rarity].name,
  score: RARITIES[rarity].score,
  fragment: RARITIES[rarity].fragment,
  price: RARITIES[rarity].price,
  quote
}));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function emptyDb() {
  return { users: [], sessions: {}, shares: [], events: [], drawRecords: [] };
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

async function readDb() {
  if (USE_SUPABASE) return readSupabaseDb();
  if (!fs.existsSync(DB_FILE)) {
    const initial = emptyDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.users ||= [];
  db.sessions ||= {};
  db.shares ||= [];
  db.events ||= [];
  db.drawRecords ||= [];
  db.users = db.users.filter(isObject);
  for (const user of db.users) ensureUserShape(user);
  return db;
}

async function writeDb(db) {
  if (USE_SUPABASE) return writeSupabaseDb(db);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

async function supabaseFetch(table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${options.query || ""}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${table} ${response.status}: ${detail}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readSupabaseDb() {
  const [players, sessions, shares, events, drawRecords] = await Promise.all([
    supabaseFetch("players", { query: "?select=*" }),
    supabaseFetch("sessions", { query: "?select=*" }),
    supabaseFetch("shares", { query: "?select=*" }),
    supabaseFetch("events", { query: "?select=*" }),
    supabaseFetch("draw_records", { query: "?select=*" })
  ]);
  const db = emptyDb();
  db.users = (players || []).map(row => ({
    id: row.id,
    nickname: row.nickname,
    passwordHash: row.password_hash,
    score: row.score,
    fragments: row.fragments,
    drawChances: row.draw_chances,
    lastRecoveredAt: row.last_recovered_at,
    openedPacks: row.opened_packs,
    ownedCards: row.owned_cards || {},
    shareRewards: row.share_rewards || {},
    taskRewards: row.task_rewards || {},
    seriesRewards: row.series_rewards || {}
  }));
  for (const row of sessions || []) db.sessions[row.token] = row.player_id;
  db.shares = (shares || []).map(row => ({
    id: row.id,
    userId: row.player_id,
    nickname: row.nickname,
    scene: row.scene,
    visits: row.visits,
    rewarded: row.rewarded,
    createdAt: row.created_at
  }));
  db.events = (events || []).map(row => ({
    id: row.id,
    type: row.type,
    userId: row.player_id,
    ownerId: row.payload?.ownerId,
    shareId: row.share_id,
    cardId: row.card_id,
    scene: row.scene,
    duplicated: row.duplicated,
    rewarded: row.rewarded,
    createdAt: row.created_at,
    payload: row.payload || {}
  }));
  db.drawRecords = (drawRecords || []).map(row => ({
    id: row.id,
    userId: row.player_id,
    nickname: row.nickname,
    cardId: row.card_id,
    cardName: row.card_name,
    series: row.series,
    rarity: row.rarity,
    rarityName: row.rarity_name,
    duplicated: row.duplicated,
    scoreGained: row.score_gained,
    fragmentsGained: row.fragments_gained,
    createdAt: row.created_at
  }));
  for (const user of db.users) ensureUserShape(user);
  return db;
}

async function upsert(table, rows, conflict) {
  if (!rows.length) return;
  await supabaseFetch(table, {
    method: "POST",
    query: `?on_conflict=${conflict}`,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: rows
  });
}

async function writeSupabaseDb(db) {
  await upsert("players", db.users.map(user => ({
    id: user.id,
    nickname: user.nickname,
    password_hash: user.passwordHash,
    score: user.score,
    fragments: user.fragments,
    draw_chances: user.drawChances,
    last_recovered_at: user.lastRecoveredAt,
    opened_packs: user.openedPacks,
    owned_cards: user.ownedCards || {},
    share_rewards: user.shareRewards || {},
    task_rewards: user.taskRewards || {},
    series_rewards: user.seriesRewards || {},
    updated_at: new Date().toISOString()
  })), "id");
  await upsert("sessions", Object.entries(db.sessions).map(([token, userId]) => ({
    token,
    player_id: userId
  })), "token");
  await upsert("shares", db.shares.map(share => ({
    id: share.id,
    player_id: share.userId,
    nickname: share.nickname,
    scene: share.scene,
    visits: share.visits,
    rewarded: share.rewarded,
    created_at: share.createdAt
  })), "id");
  await upsert("draw_records", db.drawRecords.map(record => ({
    id: record.id,
    player_id: record.userId,
    nickname: record.nickname,
    card_id: record.cardId,
    card_name: record.cardName,
    series: record.series,
    rarity: record.rarity,
    rarity_name: record.rarityName,
    duplicated: record.duplicated,
    score_gained: record.scoreGained,
    fragments_gained: record.fragmentsGained,
    created_at: record.createdAt
  })), "id");
  await upsert("events", db.events.map(event => ({
    id: event.id,
    type: event.type,
    player_id: event.userId || event.ownerId || null,
    share_id: event.shareId || null,
    card_id: event.cardId || null,
    scene: event.scene || null,
    duplicated: event.duplicated ?? null,
    rewarded: event.rewarded ?? null,
    payload: { ...event.payload, ownerId: event.ownerId || event.payload?.ownerId },
    created_at: event.createdAt
  })), "id");
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(FRONTEND_DIR, pathname));
  if (!filePath.startsWith(FRONTEND_DIR)) return json(res, 403, { message: "Forbidden" });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallback = path.join(FRONTEND_DIR, "index.html");
    return sendFile(res, fallback);
  }
  return sendFile(res, filePath);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function userView(user, db = null) {
  ensureUserShape(user);
  const drawHistory = db
    ? db.drawRecords.filter(record => record.userId === user.id).slice(-20).reverse()
    : [];
  return {
    id: user.id,
    nickname: user.nickname,
    score: user.score,
    fragments: user.fragments,
    drawChances: user.drawChances,
    maxDrawChances: MAX_DRAW_CHANCES,
    lastRecoveredAt: user.lastRecoveredAt,
    recoveryIntervalMs: DRAW_RECOVERY_INTERVAL_MS,
    openedPacks: user.openedPacks,
    ownedCards: user.ownedCards,
    shareRewards: user.shareRewards || {},
    taskRewards: user.taskRewards || {},
    seriesRewards: user.seriesRewards || {},
    drawRecords: drawHistory,
    tasks: taskStatus(user, db)
  };
}

function ensureUserShape(user) {
  if (!isObject(user)) return;
  user.id ||= id("usr");
  user.nickname ||= user.username || "拾忆者";
  user.ownedCards ||= {};
  user.shareRewards ||= {};
  user.taskRewards ||= {};
  user.seriesRewards ||= {};
  user.fragments ||= 0;
  user.score ||= 0;
  user.drawChances ||= 0;
  user.drawChances = Math.min(user.drawChances, MAX_DRAW_CHANCES);
  user.lastRecoveredAt ||= new Date().toISOString();
  user.openedPacks ||= 0;
}

function addDrawChances(user, amount) {
  ensureUserShape(user);
  user.drawChances = Math.min(MAX_DRAW_CHANCES, user.drawChances + amount);
  if (user.drawChances >= MAX_DRAW_CHANCES) user.lastRecoveredAt = new Date().toISOString();
}

function recoverDrawChances(user, now = new Date()) {
  ensureUserShape(user);
  if (user.drawChances >= MAX_DRAW_CHANCES) {
    user.lastRecoveredAt = now.toISOString();
    return 0;
  }
  const lastTime = Date.parse(user.lastRecoveredAt);
  if (!Number.isFinite(lastTime)) {
    user.lastRecoveredAt = now.toISOString();
    return 0;
  }
  const elapsed = now.getTime() - lastTime;
  if (elapsed < DRAW_RECOVERY_INTERVAL_MS) return 0;
  const recoverable = Math.floor(elapsed / DRAW_RECOVERY_INTERVAL_MS);
  const gained = Math.min(recoverable, MAX_DRAW_CHANCES - user.drawChances);
  user.drawChances += gained;
  user.lastRecoveredAt = user.drawChances >= MAX_DRAW_CHANCES
    ? now.toISOString()
    : new Date(lastTime + recoverable * DRAW_RECOVERY_INTERVAL_MS).toISOString();
  return gained;
}

function currentUser(req, db) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const userId = db.sessions[token];
  return userId ? db.users.find(user => user.id === userId) : null;
}

function weightedCard() {
  const rarityKeys = Object.keys(RARITIES);
  const total = rarityKeys.reduce((sum, key) => sum + RARITIES[key].weight, 0);
  let roll = Math.random() * total;
  let rarity = "normal";
  for (const key of rarityKeys) {
    roll -= RARITIES[key].weight;
    if (roll <= 0) {
      rarity = key;
      break;
    }
  }
  const pool = CARDS.filter(card => card.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

function record(db, event) {
  db.events.push({ id: id("evt"), createdAt: new Date().toISOString(), ...event });
}

function todayEvents(db, predicate) {
  const prefix = today();
  return db.events.filter(event => event.createdAt?.startsWith(prefix) && predicate(event));
}

function taskStatus(user, db = null) {
  ensureUserShape(user);
  const date = today();
  const drawCount = db ? todayEvents(db, event => event.type === "draw" && event.userId === user.id).length : 0;
  const shareJumpCount = db ? todayEvents(db, event => event.type === "share_visit" && event.ownerId === user.id).length : 0;
  const collectionCount = Object.keys(user.ownedCards).length;
  return [
    {
      id: "draw3",
      title: "今日开 3 包",
      progress: Math.min(drawCount, 3),
      target: 3,
      reward: "+1 抽卡",
      claimed: Boolean(user.taskRewards[`${date}:draw3`])
    },
    {
      id: "share1",
      title: "完成 1 次分享跳转",
      progress: Math.min(shareJumpCount, 1),
      target: 1,
      reward: "+20 碎片",
      claimed: Boolean(user.taskRewards[`${date}:share1`])
    },
    {
      id: "collect4",
      title: "收集 4 张不同卡",
      progress: Math.min(collectionCount, 4),
      target: 4,
      reward: "+30 碎片",
      claimed: Boolean(user.taskRewards[`${date}:collect4`])
    }
  ];
}

function applyDailyTasks(user, db) {
  ensureUserShape(user);
  const date = today();
  const rewards = [];
  const rules = [
    { id: "draw3", done: todayEvents(db, event => event.type === "draw" && event.userId === user.id).length >= 3, drawChances: 1, text: "今日开 3 包完成，奖励 1 次抽卡" },
    { id: "share1", done: todayEvents(db, event => event.type === "share_visit" && event.ownerId === user.id).length >= 1, fragments: 20, text: "分享跳转任务完成，奖励 20 碎片" },
    { id: "collect4", done: Object.keys(user.ownedCards).length >= 4, fragments: 30, text: "收集 4 张不同卡完成，奖励 30 碎片" }
  ];
  for (const rule of rules) {
    const key = `${date}:${rule.id}`;
    if (!rule.done || user.taskRewards[key]) continue;
    user.taskRewards[key] = true;
    if (rule.drawChances) addDrawChances(user, rule.drawChances);
    if (rule.fragments) user.fragments += rule.fragments;
    rewards.push(rule.text);
  }
  return rewards;
}

function applySeriesRewards(user) {
  ensureUserShape(user);
  const rewards = [];
  for (const series of SERIES) {
    const cards = CARDS.filter(card => card.series === series);
    const completed = cards.every(card => user.ownedCards[card.id]);
    if (!completed || user.seriesRewards[series]) continue;
    user.seriesRewards[series] = true;
    addDrawChances(user, 2);
    user.fragments += 30;
    rewards.push(`集齐「${series}」系列，奖励 2 抽 + 30 碎片`);
  }
  return rewards;
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!url.pathname.startsWith("/api/")) return serveStatic(req, res, url);
  const db = await readDb();

  try {
    if (req.method === "GET" && url.pathname === "/api/cards") {
      return json(res, 200, { cards: CARDS, series: SERIES, rarities: RARITIES });
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await parseBody(req);
      const password = String(body.password || "");
      const nickname = String(body.nickname || "").trim();
      if (nickname.length < 2 || password.length < 3) {
        return json(res, 400, { message: "昵称至少 2 位，密码至少 3 位" });
      }
      if (db.users.some(user => user.nickname === nickname)) {
        return json(res, 409, { message: "昵称已被使用，请换一个" });
      }
      const user = {
        id: id("usr"),
        passwordHash: hash(password),
        nickname,
        score: 0,
        fragments: 0,
        drawChances: 3,
        lastRecoveredAt: new Date().toISOString(),
        openedPacks: 0,
        ownedCards: {},
        shareRewards: {},
        taskRewards: {},
        seriesRewards: {}
      };
      const token = id("tok");
      db.users.push(user);
      db.sessions[token] = user.id;
      record(db, { type: "register", userId: user.id });
      await writeDb(db);
      return json(res, 200, { token, user: userView(user, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await parseBody(req);
      const nickname = String(body.nickname || body.username || "").trim();
      const user = db.users.find(item => item.nickname === nickname);
      if (!user || user.passwordHash !== hash(String(body.password || ""))) {
        return json(res, 401, { message: "昵称或密码错误" });
      }
      const token = id("tok");
      recoverDrawChances(user);
      db.sessions[token] = user.id;
      record(db, { type: "login", userId: user.id });
      await writeDb(db);
      return json(res, 200, { token, user: userView(user, db) });
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      const recovered = recoverDrawChances(user);
      const rewards = [...applyDailyTasks(user, db), ...applySeriesRewards(user)];
      if (recovered || rewards.length) await writeDb(db);
      return json(res, 200, { user: userView(user, db), rewards });
    }

    if (req.method === "POST" && url.pathname === "/api/draw") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      if (user.drawChances <= 0) return json(res, 400, { message: "抽卡次数不足" });
      const card = weightedCard();
      user.drawChances -= 1;
      user.openedPacks += 1;
      const oldCount = user.ownedCards[card.id] || 0;
      let result;
      if (oldCount > 0) {
        user.ownedCards[card.id] = oldCount + 1;
        user.fragments += card.fragment;
        result = { duplicated: true, fragmentsGained: card.fragment, scoreGained: 0 };
      } else {
        user.ownedCards[card.id] = 1;
        user.score += card.score;
        result = { duplicated: false, fragmentsGained: 0, scoreGained: card.score };
      }
      if (user.openedPacks % 5 === 0) addDrawChances(user, 1);
      const drawRecord = {
        id: id("draw"),
        userId: user.id,
        nickname: user.nickname,
        cardId: card.id,
        cardName: card.name,
        series: card.series,
        rarity: card.rarity,
        rarityName: card.rarityName,
        duplicated: result.duplicated,
        scoreGained: result.scoreGained,
        fragmentsGained: result.fragmentsGained,
        createdAt: new Date().toISOString()
      };
      db.drawRecords.push(drawRecord);
      record(db, { type: "draw", userId: user.id, cardId: card.id, duplicated: result.duplicated });
      const rewards = [...applyDailyTasks(user, db), ...applySeriesRewards(user)];
      await writeDb(db);
      return json(res, 200, { card, result, drawRecord, rewards, user: userView(user, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/exchange") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      const body = await parseBody(req);
      const card = CARDS.find(item => item.id === body.cardId);
      if (!card) return json(res, 404, { message: "卡牌不存在" });
      if (user.ownedCards[card.id]) return json(res, 400, { message: "你已经拥有这张卡" });
      if (user.fragments < card.price) return json(res, 400, { message: "碎片不足" });
      user.fragments -= card.price;
      user.ownedCards[card.id] = 1;
      user.score += card.score;
      record(db, { type: "exchange", userId: user.id, cardId: card.id });
      const rewards = [...applyDailyTasks(user, db), ...applySeriesRewards(user)];
      await writeDb(db);
      return json(res, 200, { card, rewards, user: userView(user, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/share/create") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      const body = await parseBody(req);
      const scene = String(body.scene || "invite");
      const share = {
        id: id("shr"),
        userId: user.id,
        nickname: user.nickname,
        scene,
        visits: 0,
        rewarded: false,
        createdAt: new Date().toISOString()
      };
      db.shares.push(share);
      record(db, { type: "share_create", userId: user.id, shareId: share.id, scene });
      await writeDb(db);
      return json(res, 200, { share, shareUrl: `../frontend/share.html?shareId=${share.id}` });
    }

    if (req.method === "POST" && url.pathname === "/api/share/visit") {
      const body = await parseBody(req);
      const share = db.shares.find(item => item.id === body.shareId);
      if (!share) return json(res, 404, { message: "分享不存在" });
      const owner = db.users.find(user => user.id === share.userId);
      if (!owner) return json(res, 404, { message: "分享者不存在" });
      recoverDrawChances(owner);
      share.visits += 1;
      let reward = null;
      const key = `${today()}:${share.scene}`;
      if (!owner.shareRewards[key]) owner.shareRewards[key] = 0;
      if (owner.shareRewards[key] < 1) {
        owner.shareRewards[key] += 1;
        addDrawChances(owner, 1);
        share.rewarded = true;
        reward = { drawChances: 1, message: "分享跳转奖励已到账" };
      }
      record(db, { type: "share_visit", shareId: share.id, ownerId: owner.id, scene: share.scene, rewarded: Boolean(reward) });
      const rewards = applyDailyTasks(owner, db);
      await writeDb(db);
      return json(res, 200, { share, owner: { nickname: owner.nickname }, reward, taskRewards: rewards });
    }

    if (req.method === "GET" && url.pathname === "/api/ranking") {
      const playerRows = [...db.users]
        .sort((a, b) => b.score - a.score)
        .map(user => ({
          player: true,
          userId: user.id,
          nickname: user.nickname,
          score: user.score,
          collected: Object.keys(user.ownedCards).length,
          total: CARDS.length
        }));
      const ranking = [...playerRows, ...NPC_RANKING.map(npc => ({ ...npc, total: CARDS.length, player: false }))]
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map((row, index) => ({
          rank: index + 1,
          ...row
        }));
      return json(res, 200, { ranking });
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      return json(res, 200, {
        users: db.users.length,
        shares: db.shares.length,
        visits: db.events.filter(event => event.type === "share_visit").length,
        draws: db.drawRecords.length
      });
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      return json(res, 200, {
        users: db.users.map(user => ({
          id: user.id,
          nickname: user.nickname,
          score: user.score,
          fragments: user.fragments,
          drawChances: user.drawChances,
          openedPacks: user.openedPacks,
          collected: Object.keys(user.ownedCards).length,
          drawRecords: db.drawRecords.filter(record => record.userId === user.id)
        }))
      });
    }

    return json(res, 404, { message: "接口不存在" });
  } catch (error) {
    return json(res, 500, { message: "服务器错误", detail: error.message });
  }
}

http.createServer(handle).listen(PORT, HOST, () => {
  console.log(`Guangzai backend is running at http://${HOST}:${PORT}`);
});
