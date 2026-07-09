const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
console.log("当前运行的 server.js 已加载：return/profile debug 版本");
const DB_FILE = path.join(__dirname, "db.json");
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
loadEnv(path.join(ROOT_DIR, ".env"));
loadEnv(path.join(__dirname, ".env"));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || "",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "",
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 20),
  queueLimit: 0,
  charset: "utf8mb4"
};
const USE_MYSQL = Boolean(MYSQL_CONFIG.host && MYSQL_CONFIG.user && MYSQL_CONFIG.database);
const REDIS_URL = process.env.REDIS_URL || "";
const MAX_DRAW_CHANCES = 15;
const TOKEN_CACHE_TTL_MS = 2 * 60 * 1000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const RANKING_CACHE_TTL_SECONDS = 8;
const tokenUserCache = new Map();
let mysqlPool = null;
let mysqlSchemaReady = false;
let redisClient = null;
let redisReady = false;
let redisConnecting = null;
const SERIES = ["竞技高光", "冥场面", "社区梗", "经典瞬间"];
const NPC_RANKING = [];
const RARITIES = {
  normal: { name: "普通", weight: 58, score: 10, fragment: 2, price: 12 },
  rare: { name: "稀有", weight: 27, score: 30, fragment: 6, price: 28 },
  epic: { name: "史诗", weight: 11, score: 80, fragment: 16, price: 70 },
  legend: { name: "传说", weight: 3.5, score: 180, fragment: 36, price: 160 },
  hidden: { name: "隐藏款", weight: 0.5, score: 400, fragment: 80, price: 360 }
};

const CARDS = [
  ["c001", "伏地魔的胜利", "竞技高光", "normal", "和平精英", "伏地不是怂，是对大地的忠诚。"],
  ["c002", "有老六，有老六！", "竞技高光", "normal", "和平精英", "前方刚枪猛如虎，身后老六偷屁股。"],
  ["c003", "经济局翻盘", "竞技高光", "normal", "无畏契约", "经济局不是劣势，是打脸的前奏。"],
  ["c004", "康康的1v3残局", "竞技高光", "rare", "无畏契约", "不需要声音—三根弹道线就是三个击杀。"],
  ["c005", "whzy血量仅剩一滴", "竞技高光", "rare", "无畏契约", "whzy告诉你残局不是数学题—是阅读理解。"],
  ["c006", "名刀司命", "竞技高光", "normal", "KPL", "他出了一个名刀司命！"],
  ["c007", "Fly的关羽", "竞技高光", "normal", "KPL", "Fly的关羽—不是骑马，是骑在对面脸上。"],
  ["c008", "天神下凡", "竞技高光", "normal", "LPL", "天神下凡，一锤四。"],
  ["c009", "永远滴神", "竞技高光", "normal", "LPL", "乌兹，永远滴神。"],
  ["c010", "让二追三", "竞技高光", "epic", "LPL", "让二追三不是奇迹，是TES给全世界上的一课。"],
  ["c011", "太阳升起就把昨天忘掉", "竞技高光", "rare", "LPL", "太阳升起时，就把昨天忘掉。"],
  ["c012", "Faker沙皇推五个", "竞技高光", "hidden", "LCK", "不必知道比分—这一帧就够了。"],
  ["c013", "Faker的四冠", "竞技高光", "epic", "LCK", "传奇永不熄——他用了七年证明这句话。"],
  ["c014", "Deft最后一舞", "竞技高光", "legend", "LCK", "十年一冠，最后一舞—Deft配得上这个结局。"],
  ["c015", "救救我！救救我！", "冥场面", "normal", "和平精英", "本想等队友救命，没想到等来一场坟头电摇表演。"],
  ["c016", "人体描边大师", "冥场面", "normal", "和平精英", "你的枪法，一幅完美的轮廓画。"],
  ["c017", "落地成盒", "冥场面", "rare", "和平精英", "吃鸡玩家的共同初体验——我还没落地，战斗已结束。"],
  ["c018", "闪现撞墙", "冥场面", "normal", "英雄联盟手游", "墙：你来了？"],
  ["c019", "0-21的亚索", "冥场面", "rare", "英雄联盟手游", "快乐风男，从不看战绩。"],
  ["c020", "五杀被抢", "冥场面", "rare", "英雄联盟手游", "兄弟，我们得谈谈。"],
  ["c021", "团战可以输", "冥场面", "normal", "王者荣耀", "团战可以输，鲁班必须死。"],
  ["c022", "干得漂亮", "冥场面", "normal", "王者荣耀", "这四个字，是王者最狠的脏话。"],
  ["c023", "射手孤儿路", "冥场面", "normal", "王者荣耀", "发育路不是路，是孤儿院。"],
  ["c024", "精准Timing", "冥场面", "epic", "无畏契约", "0.1秒的遗憾，一生的阴影。"],
  ["c025", "搜打撤", "冥场面", "normal", "三角洲行动", "搜打撤，搜了白搜，打了白打，撤了白撤。"],
  ["c026", "一诺行为", "冥场面", "legend", "KPL", "一诺把队友全杀了！——这一刀，永远留在KPL历史里。"],
  ["c027", "1557", "冥场面", "hidden", "LPL", "1557——SKT最不愿提的数字。"],
  ["c028", "马西西超市一串四", "冥场面", "epic", "CS", "导购在超市是无敌的——马西西的嘴开了光。"],
  ["c029", "越打越年轻", "社区梗", "normal", "和平精英", "有款游戏越打越年轻，就是手机和平精英。"],
  ["c030", "变形重组器", "社区梗", "rare", "金铲铲之战", "重组器一响，爹妈白养。"],
  ["c031", "D牌上头", "社区梗", "normal", "金铲铲之战", "我就再D一下——崩溃的开始。"],
  ["c032", "空城连败", "社区梗", "rare", "金铲铲之战", "空城不是认输，是梭哈的前奏。"],
  ["c033", "老八出局", "社区梗", "normal", "金铲铲之战", "开局三连败，这把老八的局。"],
  ["c034", "菜就多练", "社区梗", "normal", "蛋仔派对", "菜就多练——游戏界的'那咋了'。"],
  ["c035", "竞速互啄", "社区梗", "normal", "蛋仔派对", "友谊的小船，在第一个弯道就翻了。"],
  ["c036", "大树守卫教你做人", "社区梗", "epic", "艾尔登法环", "宫崎英高把这东西放在门口，是想说：欢迎来到交界地——然后去死。"],
  ["c037", "军需十连抽全紫", "社区梗", "rare", "通用/光子", "免费下载，付费呼吸——而且呼吸也不一定能出金。"],
  ["c038", "排队人数999+", "社区梗", "normal", "通用/光子", "光子的服务器——不登不知道，一登前面还有三千人。"],
  ["c039", "久诚的干将", "社区梗", "epic", "KPL", "久诚的干将，锁头挂都不敢这么准。"],
  ["c040", "为什么不ban猛犸", "社区梗", "legend", "DOTA2", "为什么不ban猛犸——DOTA圈永远的悬案。"],
  ["c041", "蛋总解说", "社区梗", "normal", "CS", "蛋总的声带不是声带，是CS的专属BGM。"],
  ["c042", "地铁鼠鼠", "经典瞬间", "normal", "和平精英", "正式确诊为地铁鼠鼠！"],
  ["c043", "鼠鼠", "经典瞬间", "normal", "三角洲行动", "鼠鼠我呀，又来捡垃圾了。"],
  ["c044", "三星五费", "经典瞬间", "rare", "金铲铲之战", "三星五费不是阵容，是信仰。"],
  ["c045", "王炸！", "经典瞬间", "normal", "欢乐斗地主", "王炸——斗地主最高礼仪。"],
  ["c046", "十七张牌你能秒我", "经典瞬间", "normal", "欢乐斗地主", "十七张牌你能秒我？——还真能。"],
  ["c047", "盲狙天使", "经典瞬间", "epic", "CS", "盲狙天使，简单的男人。"],
  ["c048", "s1mple低头", "经典瞬间", "epic", "CS", "他低头的时候，你就知道对面没了。"],
  ["c049", "恭喜OG", "经典瞬间", "normal", "DOTA2", "恭喜OG——没有人相信他们能赢，除了他们自己。"],
  ["c050", "烟火", "经典瞬间", "legend", "DOTA2", "我叫Maybe，因为一切都是命中注定——但烟火不是。"],
  ["c051", "虎先锋三拳", "经典瞬间", "normal", "黑神话：悟空", "你不是第一个死在这里的，也不是最后一个。"],
  ["c052", "二郎神启动", "经典瞬间", "rare", "黑神话：悟空", "二郎神启动——全网的颈椎都跟着转了。"],
  ["c053", "影心丢骰子", "经典瞬间", "rare", "博德之门3", "我相信命运——命运说我大失败。"],
  ["c054", "工厂流水线", "经典瞬间", "normal", "幻兽帕鲁", "帕鲁不是伙伴，是生产力。"]
].map(([id, name, series, rarity, source, quote]) => ({
  id,
  name,
  series,
  source,
  rarity,
  rarityName: RARITIES[rarity].name,
  score: RARITIES[rarity].score,
  fragment: RARITIES[rarity].fragment,
  price: RARITIES[rarity].price,
  quote
}));

const MENU_COMBOS = [
  {
    id: "peace-elite",
    game: "和平精英",
    title: "和平精英名场面彩蛋",
    cardIds: ["c016", "c001", "c015"],
    reward: { drawChances: 3 },
    text: "触发「和平精英」彩蛋组合，奖励 3 次抽卡机会"
  },
  {
    id: "lol-mobile",
    game: "英雄联盟手游",
    title: "英雄联盟手游名场面彩蛋",
    cardIds: ["c018", "c019", "c020"],
    reward: { drawChances: 5 },
    text: "触发「英雄联盟手游」彩蛋组合，奖励 5 次抽卡机会"
  },
  {
    id: "jcc",
    game: "金铲铲之战",
    title: "金铲铲之战名场面彩蛋",
    cardIds: ["c033", "c032", "c031"],
    reward: { fragments: 4 },
    text: "触发「金铲铲之战」彩蛋组合，奖励 4 碎片"
  }
];

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
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

async function mysql() {
  if (!mysqlPool) {
    const mysql2 = require("mysql2/promise");
    mysqlPool = mysql2.createPool(MYSQL_CONFIG);
  }
  if (!mysqlSchemaReady) {
    try {
      await mysqlPool.execute("alter table players add column last_login_at datetime(3) null after last_recovered_at");
    } catch (error) {
      if (!/Duplicate column/i.test(error.message)) throw error;
    }
    try {
      await mysqlPool.execute("alter table shares add column payload json null after rewarded");
    } catch (error) {
      if (!/Duplicate column/i.test(error.message)) throw error;
    }
    mysqlSchemaReady = true;
  }
  return mysqlPool;
}

async function mysqlQuery(sql, params = []) {
  const pool = await mysql();

  const safeParams = params.map(value => value === undefined ? null : value);

  try {
    const [rows] = await pool.execute(sql, safeParams);
    return rows;
  } catch (error) {
    console.error("MySQL 执行失败");
    console.error("SQL:", sql);
    console.error("原始参数:", params);
    console.error("修正参数:", safeParams);
    console.error("错误:", error);
    throw error;
  }
}

async function redis() {
  if (!REDIS_URL) return null;
  if (redisReady) return redisClient;
  if (redisClient?.isOpen) {
    redisReady = true;
    return redisClient;
  }
  if (redisConnecting) return redisConnecting;
  if (!redisClient) {
    const { createClient } = require("redis");
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", error => {
      redisReady = false;
      redisConnecting = null;
      console.error("redis error:", error.message);
    });
    redisClient.on("end", () => {
      redisReady = false;
      redisConnecting = null;
    });
  }

  redisConnecting = (async () => {
    await redisClient.connect();
    redisReady = true;
    return redisClient;
  })();

  try {
    return await redisConnecting;
  } catch (error) {
    redisReady = false;
    redisConnecting = null;
    if (redisClient?.isOpen) {
      try {
        await redisClient.disconnect();
      } catch {}
    }
    console.error("redis connect failed:", error.message);
    return null;
  } finally {
    if (redisReady) redisConnecting = null;
  }
}

async function redisGet(key) {
  const client = await redis();
  if (!client) return null;
  try {
    return client.get(key);
  } catch {
    return null;
  }
}

async function redisSet(key, value, ttlSeconds = null) {
  const client = await redis();
  if (!client) return false;
  try {
    if (ttlSeconds) await client.set(key, value, { EX: ttlSeconds });
    else await client.set(key, value);
    return true;
  } catch {
    return false;
  }
}

async function redisDel(key) {
  const client = await redis();
  if (!client) return false;
  try {
    await client.del(key);
    return true;
  } catch {
    return false;
  }
}

function parseJsonValue(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sqlDate(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

function isoDate(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function nullableIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mysqlRowToUser(row) {
  if (!row) return null;
  const user = {
    id: row.id,
    nickname: row.nickname,
    passwordHash: row.password_hash,
    score: row.score,
    fragments: row.fragments,
    drawChances: row.draw_chances,
    lastRecoveredAt: isoDate(row.last_recovered_at),
    lastLoginAt: nullableIsoDate(row.last_login_at),
    openedPacks: row.opened_packs,
    ownedCards: parseJsonValue(row.owned_cards, {}),
    shareRewards: parseJsonValue(row.share_rewards, {}),
    taskRewards: parseJsonValue(row.task_rewards, {}),
    seriesRewards: parseJsonValue(row.series_rewards, {}),
    milestoneRewards: parseJsonValue(row.milestone_rewards, { score: {}, packs: {} }),
    challengeState: parseJsonValue(row.challenge_state, {}),
    effectState: parseJsonValue(row.effect_state, {})
  };
  ensureUserShape(user);
  return user;
}

function mysqlDrawRecord(row) {
  return {
    id: row.id,
    userId: row.player_id,
    nickname: row.nickname,
    cardId: row.card_id,
    cardName: row.card_name,
    series: row.series,
    rarity: row.rarity,
    rarityName: row.rarity_name,
    duplicated: Boolean(row.duplicated),
    scoreGained: row.score_gained,
    fragmentsGained: row.fragments_gained,
    createdAt: isoDate(row.created_at)
  };
}

function mysqlEvent(row) {
  const payload = parseJsonValue(row.payload, {});
  return {
    id: row.id,
    type: row.type,
    userId: row.player_id,
    ownerId: payload.ownerId || row.player_id,
    shareId: row.share_id,
    cardId: row.card_id,
    scene: row.scene,
    duplicated: row.duplicated == null ? null : Boolean(row.duplicated),
    rewarded: row.rewarded == null ? null : Boolean(row.rewarded),
    createdAt: isoDate(row.created_at),
    payload
  };
}

async function getMysqlPlayerByNickname(nickname) {
  const rows = await mysqlQuery("select * from players where nickname = ? limit 1", [nickname]);
  return mysqlRowToUser(rows[0]);
}

async function getMysqlPlayerById(userId) {
  const rows = await mysqlQuery("select * from players where id = ? limit 1", [userId]);
  return mysqlRowToUser(rows[0]);
}

async function updateMysqlPlayer(user) {
  ensureUserShape(user);
  await mysqlQuery(
    `insert into players (
      id, nickname, password_hash, score, fragments,
      draw_chances, last_recovered_at, last_login_at, opened_packs, owned_cards, share_rewards,
      task_rewards, series_rewards, milestone_rewards, challenge_state, effect_state
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on duplicate key update
      nickname = values(nickname),
      password_hash = values(password_hash),
      score = values(score),
      fragments = values(fragments),
      draw_chances = values(draw_chances),
      last_recovered_at = values(last_recovered_at),
      last_login_at = values(last_login_at),
      opened_packs = values(opened_packs),
      owned_cards = values(owned_cards),
      share_rewards = values(share_rewards),
      task_rewards = values(task_rewards),
      series_rewards = values(series_rewards),
      milestone_rewards = values(milestone_rewards),
      challenge_state = values(challenge_state),
      effect_state = values(effect_state)`,
    [
      user.id,
      user.nickname,
      user.passwordHash,
      user.score,
      user.fragments,
      user.drawChances,
      sqlDate(user.lastRecoveredAt),
      user.lastLoginAt ? sqlDate(user.lastLoginAt) : null,
      user.openedPacks,
      JSON.stringify(user.ownedCards || {}),
      JSON.stringify(user.shareRewards || {}),
      JSON.stringify(user.taskRewards || {}),
      JSON.stringify(user.seriesRewards || {}),
      JSON.stringify(user.milestoneRewards || { score: {}, packs: {} }),
      JSON.stringify(user.challengeState || {}),
      JSON.stringify(user.effectState || {})
    ]
  );
}

async function setMysqlSession(token, userId) {
  const stored = await redisSet(`session:${token}`, userId, SESSION_TTL_SECONDS);
  if (!stored) {
    await mysqlQuery(
      `insert into sessions (token, player_id, expires_at)
       values (?, ?, ?)
       on duplicate key update player_id = values(player_id), expires_at = values(expires_at)`,
      [token, userId, sqlDate(Date.now() + SESSION_TTL_SECONDS * 1000)]
    );
  }
}

async function getMysqlUserByToken(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const cached = cachedUser(token);
  if (cached) return cached;
  let userId = await redisGet(`session:${token}`);
  if (!userId) {
    const rows = await mysqlQuery(
      "select player_id from sessions where token = ? and expires_at > now(3) limit 1",
      [token]
    );
    userId = rows[0]?.player_id;
  }
  if (!userId) return null;

  const user = await getMysqlPlayerById(userId);
  if (!user) return null;

  cacheUser(token, user);
  return user;
}

async function insertMysqlEvent(event) {
  await mysqlQuery(
    `insert into events (id, type, player_id, share_id, card_id, scene, duplicated, rewarded, payload, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id || id("evt"),
      event.type,
      event.userId || event.ownerId || null,
      event.shareId || null,
      event.cardId || null,
      event.scene || null,
      event.duplicated == null ? null : Number(Boolean(event.duplicated)),
      event.rewarded == null ? null : Number(Boolean(event.rewarded)),
      JSON.stringify({ ...(event.payload || {}), ownerId: event.ownerId || event.payload?.ownerId }),
      sqlDate(event.createdAt || new Date())
    ]
  );
}

function queueMysqlEvent(event) {
  insertMysqlEvent(event).catch(error => {
    console.error("mysql event insert failed:", error.message);
  });
}

async function insertMysqlDrawRecord(record) {
  await mysqlQuery(
    `insert into draw_records (
      id, player_id, nickname, card_id, card_name, series, rarity, rarity_name,
      duplicated, score_gained, fragments_gained, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.userId,
      record.nickname,
      record.cardId,
      record.cardName,
      record.series,
      record.rarity,
      record.rarityName,
      Number(Boolean(record.duplicated)),
      record.scoreGained,
      record.fragmentsGained,
      sqlDate(record.createdAt)
    ]
  );
}

async function getMysqlRecentDrawRecords(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));

  const rows = await mysqlQuery(
      `select * from draw_records where player_id = ? order by created_at desc limit ${safeLimit}`,
      [userId]
  );

  return rows.map(mysqlDrawRecord);
}

function mysqlJsonCardPath(cardId) {
  const safeId = String(cardId || "");
  if (!/^[a-z0-9_-]+$/i.test(safeId)) return null;
  return `$.${safeId}`;
}

async function countMysqlCardOwners(cardId) {
  const path = mysqlJsonCardPath(cardId);
  if (!path) return 0;
  const rows = await mysqlQuery(
    "select count(*) as count from players where json_contains_path(owned_cards, 'one', ?)",
    [path]
  );
  return Number(rows[0]?.count || 0);
}

async function countMysqlCardDraws(cardId) {
  const rows = await mysqlQuery(
    "select count(*) as count from draw_records where card_id = ?",
    [cardId]
  );
  return Number(rows[0]?.count || 0);
}

async function attachMysqlCardStats(pack) {
  await Promise.all(pack.draws.map(async item => {
    const [drawRank, collectorRank] = await Promise.all([
      countMysqlCardDraws(item.card.id),
      item.result.duplicated ? Promise.resolve(null) : countMysqlCardOwners(item.card.id)
    ]);
    item.result.drawRank = drawRank;
    if (collectorRank) item.result.collectorRank = collectorRank;
  }));
}

async function getMysqlTodayUserEvents(userId) {
  const rows = await mysqlQuery(
    "select * from events where player_id = ? and created_at >= date_sub(now(3), interval 2 day) order by created_at asc",
    [userId]
  );
  const date = today();
  return rows.map(mysqlEvent).filter(event => event.createdAt && todayOf(event.createdAt) === date);
}

async function mysqlUserView(user, includeDrawRecords = false) {
  const [drawRecords, events] = await Promise.all([
    includeDrawRecords ? getMysqlRecentDrawRecords(user.id) : Promise.resolve([]),
    getMysqlTodayUserEvents(user.id)
  ]);
  return userView(user, { drawRecords, events });
}

async function getMysqlShareById(shareId) {
  const rows = await mysqlQuery("select * from shares where id = ? limit 1", [shareId]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.player_id,
    nickname: row.nickname,
    scene: row.scene,
    visits: row.visits,
    rewarded: Boolean(row.rewarded),
    payload: parseJsonValue(row.payload, {}),
    createdAt: isoDate(row.created_at)
  };
}

async function upsertMysqlShare(share) {
  await mysqlQuery(
    `insert into shares (id, player_id, nickname, scene, visits, rewarded, payload, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on duplicate key update visits = values(visits), rewarded = values(rewarded), payload = values(payload)`,
    [
      share.id,
      share.userId,
      share.nickname,
      share.scene,
      share.visits,
      Number(Boolean(share.rewarded)),
      JSON.stringify(share.payload || {}),
      sqlDate(share.createdAt)
    ]
  );
}

async function getMysqlRankingRows() {
  const cached = await redisGet("ranking:v1");
  if (cached) return JSON.parse(cached);
  const rows = await mysqlQuery(
    "select id, nickname, score, owned_cards from players order by score desc limit 50"
  );
  const playerRows = rows.map(row => ({
    player: true,
    userId: row.id,
    nickname: row.nickname,
    score: row.score || 0,
    collected: Object.keys(parseJsonValue(row.owned_cards, {})).length,
    total: CARDS.length
  }));
  const ranking = [...playerRows, ...NPC_RANKING.map(npc => ({ ...npc, total: CARDS.length, player: false }))]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((row, index) => ({ rank: index + 1, ...row }));
  await redisSet("ranking:v1", JSON.stringify(ranking), RANKING_CACHE_TTL_SECONDS);
  return ranking;
}

async function invalidateRankingCache() {
  await redisDel("ranking:v1");
}

function rowToUser(row) {
  if (!row) return null;
  const user = {
    id: row.id,
    nickname: row.nickname,
    passwordHash: row.password_hash,
    score: row.score,
    fragments: row.fragments,
    drawChances: row.draw_chances,
    lastRecoveredAt: row.last_recovered_at,
    lastLoginAt: row.last_login_at || null,
    openedPacks: row.opened_packs,
    ownedCards: row.owned_cards || {},
    shareRewards: row.share_rewards || {},
    taskRewards: row.task_rewards || {},
    seriesRewards: row.series_rewards || {},
    milestoneRewards: row.milestone_rewards || {},
    challengeState: row.challenge_state || {},
    effectState: row.effect_state || {}
  };
  ensureUserShape(user);
  return user;
}

function userToPlayerRow(user) {
  ensureUserShape(user);
  return {
    id: user.id,
    nickname: user.nickname,
    password_hash: user.passwordHash,
    score: user.score,
    fragments: user.fragments,
    draw_chances: user.drawChances,
    last_recovered_at: user.lastRecoveredAt,
    last_login_at: user.lastLoginAt,
    opened_packs: user.openedPacks,
    owned_cards: user.ownedCards || {},
    share_rewards: user.shareRewards || {},
    task_rewards: user.taskRewards || {},
    series_rewards: user.seriesRewards || {},
    milestone_rewards: user.milestoneRewards || {},
    challenge_state: user.challengeState || {},
    effect_state: user.effectState || {},
    updated_at: new Date().toISOString()
  };
}

function eventToRow(event) {
  return {
    id: event.id || id("evt"),
    type: event.type,
    player_id: event.userId || event.ownerId || null,
    share_id: event.shareId || null,
    card_id: event.cardId || null,
    scene: event.scene || null,
    duplicated: event.duplicated ?? null,
    rewarded: event.rewarded ?? null,
    payload: { ...(event.payload || {}), ownerId: event.ownerId || event.payload?.ownerId },
    created_at: event.createdAt || new Date().toISOString()
  };
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.replace(/^Bearer\s+/i, "");
}

function cacheUser(token, user) {
  if (!token || !user) return;
  tokenUserCache.set(token, {
    user,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS
  });
}

function cachedUser(token) {
  const item = tokenUserCache.get(token);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    tokenUserCache.delete(token);
    return null;
  }
  item.expiresAt = Date.now() + TOKEN_CACHE_TTL_MS;
  return item.user;
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

function normalizeAccount(value) {
  return String(value || "").trim().toLowerCase();
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function dayIndex(date = today()) {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 86_400_000);
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
    openedPacks: user.openedPacks,
    ownedCards: user.ownedCards,
    shareRewards: user.shareRewards || {},
    taskRewards: user.taskRewards || {},
    seriesRewards: user.seriesRewards || {},
    milestoneRewards: user.milestoneRewards || {},
    challengeState: user.challengeState || {},
    effectState: user.effectState || {},
    drawRecords: drawHistory,
    tasks: taskStatus(user, db)
  };
}

function ensureUserShape(user) {
  if (!isObject(user)) return;
  user.id ||= id("usr");
  user.nickname ||= user.username || "拾忆者";
  if (!isObject(user.ownedCards)) user.ownedCards = {};
  if (!isObject(user.shareRewards)) user.shareRewards = {};
  if (!isObject(user.taskRewards)) user.taskRewards = {};
  if (!isObject(user.seriesRewards)) user.seriesRewards = {};
  if (!isObject(user.milestoneRewards)) user.milestoneRewards = {};
  user.milestoneRewards.score ||= {};
  user.milestoneRewards.packs ||= {};
  if (!isObject(user.challengeState)) user.challengeState = {};
  if (!isObject(user.challengeState.menuCombos)) user.challengeState.menuCombos = {};
  if (!isObject(user.effectState)) user.effectState = {};
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

function dailyLoginReward(user, now = new Date()) {
  const currentDate = today();
  const lastLoginDate = user.lastLoginAt ? todayOf(user.lastLoginAt) : null;
  if (!user.lastLoginAt || lastLoginDate !== currentDate) {
    ensureUserShape(user);
    const before = user.drawChances;
    addDrawChances(user, 3);
    user.lastLoginAt = now.toISOString();
    return user.drawChances - before;
  }
  return 0;
}

function todayOf(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function recoverDrawChances(user, now = new Date()) {
  ensureUserShape(user);
  user.lastRecoveredAt ||= now.toISOString();
  return 0;
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

function drawPoint() {
  return Math.floor(Math.random() * 13) + 1;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function weightedUniqueCards(count) {
  const picked = [];
  const pickedIds = new Set();
  let attempts = 0;
  while (picked.length < count && attempts < count * 80) {
    attempts += 1;
    const card = weightedCard();
    if (!card || pickedIds.has(card.id)) continue;
    picked.push(card);
    pickedIds.add(card.id);
  }
  if (picked.length < count) {
    for (const card of shuffle(CARDS)) {
      if (picked.length >= count) break;
      if (pickedIds.has(card.id)) continue;
      picked.push(card);
      pickedIds.add(card.id);
    }
  }
  return picked;
}

function find24Triple(points) {
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      for (let c = b + 1; c < points.length; c += 1) {
        const solution = solve24([points[a], points[b], points[c]]);
        if (solution.success) return { indexes: [a, b, c], solution };
      }
    }
  }
  return null;
}

function drawSolvablePackPoints(count = 4) {
  for (let attempts = 0; attempts < 800; attempts += 1) {
    const points = Array.from({ length: count }, drawPoint);
    if (find24Triple(points)) return points;
  }
  return shuffle([6, 4, 1, drawPoint()]);
}

function rarityPower(card) {
  return RARITIES[card.rarity]?.score || 0;
}

function applyDrawnCard(user, card) {
  const oldCount = user.ownedCards[card.id] || 0;
  if (oldCount > 0) {
    user.ownedCards[card.id] = oldCount + 1;
    user.fragments += card.fragment;
    return { duplicated: true, fragmentsGained: card.fragment, scoreGained: 0 };
  }
  user.ownedCards[card.id] = 1;
  user.score += card.score;
  return { duplicated: false, fragmentsGained: 0, scoreGained: card.score };
}

function publicPackSlots(slots) {
  return slots.map(slot => ({
    ...slot.card,
    slotId: slot.slotId,
    point: slot.point
  }));
}

function createPendingPack(user, count = 4) {
  ensureUserShape(user);
  const createdAt = new Date().toISOString();
  const points = drawSolvablePackPoints(count);
  const cards = weightedUniqueCards(count);
  const pack = {
    id: id("pack"),
    createdAt,
    slots: Array.from({ length: count }, (_, index) => ({
      slotId: id("slot"),
      point: points[index],
      card: cards[index]
    }))
  };
  user.challengeState.pendingPack = pack;
  return pack;
}

function settlePendingPack(user, selectedSlotIds) {
  ensureUserShape(user);
  const pack = user.challengeState.pendingPack;
  if (!pack) return { error: "请先开包抽出 4 张候选卡" };
  const uniqueIds = [...new Set((selectedSlotIds || []).map(String))];
  if (uniqueIds.length !== 3) return { error: "请选择 3 张卡放入卡册" };
  const selected = uniqueIds.map(slotId => pack.slots.find(slot => slot.slotId === slotId));
  if (selected.some(slot => !slot)) return { error: "选择的卡不在当前开包结果里" };
  const discarded = pack.slots.find(slot => !uniqueIds.includes(slot.slotId));
  const createdAt = new Date().toISOString();
  const draws = selected.map(slot => {
    const result = applyDrawnCard(user, slot.card);
    return {
      card: slot.card,
      point: slot.point,
      slotId: slot.slotId,
      result,
      drawRecord: {
      id: id("draw"),
      userId: user.id,
      nickname: user.nickname,
        cardId: slot.card.id,
        cardName: slot.card.name,
        series: slot.card.series,
        rarity: slot.card.rarity,
        rarityName: slot.card.rarityName,
      duplicated: result.duplicated,
      scoreGained: result.scoreGained,
      fragmentsGained: result.fragmentsGained,
      createdAt
      }
    };
  });
  const points = selected.map(slot => slot.point);
  const solution = solve24(points);
  const puzzle24 = {
    points,
    formula: solution.formula,
    success: solution.success,
    reward: null
  };
  if (solution.success) {
    addDrawChances(user, 1);
    puzzle24.reward = { drawChances: 1, text: "三张卡凑出 24 点，返还 1 次抽卡机会" };
  }
  const highlight = draws.reduce((best, item) => {
    if (!best) return item;
    if (rarityPower(item.card) !== rarityPower(best.card)) {
      return rarityPower(item.card) > rarityPower(best.card) ? item : best;
    }
    return item.card.score > best.card.score ? item : best;
  }, null);
  user.challengeState.pendingPack = null;
  return { draws, puzzle24, highlight, discarded };
}

function randomPointCard() {
  const card = weightedCard();
  return {
    slotId: id("slot"),
    point: Math.floor(Math.random() * 13) + 1,
    card
  };
}

function solve24(points) {
  const EPS = 1e-8;
  const initial = points.map(point => ({ value: point, formula: String(point) }));

  function search(items) {
    if (items.length === 1) {
      return Math.abs(items[0].value - 24) < EPS ? items[0].formula : null;
    }
    for (let i = 0; i < items.length; i += 1) {
      for (let j = 0; j < items.length; j += 1) {
        if (i === j) continue;
        const rest = items.filter((_, index) => index !== i && index !== j);
        const a = items[i];
        const b = items[j];
        const candidates = [
          { value: a.value + b.value, formula: `(${a.formula}+${b.formula})` },
          { value: a.value - b.value, formula: `(${a.formula}-${b.formula})` },
          { value: a.value * b.value, formula: `(${a.formula}×${b.formula})` }
        ];
        if (Math.abs(b.value) > EPS) {
          candidates.push({ value: a.value / b.value, formula: `(${a.formula}÷${b.formula})` });
        }
        for (const candidate of candidates) {
          const found = search([...rest, candidate]);
          if (found) return found;
        }
      }
    }
    return null;
  }

  const formula = search(initial);
  return { success: Boolean(formula), formula };
}

function record(db, event) {
  db.events.push({ id: id("evt"), createdAt: new Date().toISOString(), ...event });
}

function countLocalCardOwners(db, cardId) {
  return db.users.filter(user => user.ownedCards && user.ownedCards[cardId]).length;
}

function countLocalCardDraws(db, cardId) {
  return db.drawRecords.filter(record => record.cardId === cardId).length;
}

function attachLocalCardStats(pack, db) {
  for (const item of pack.draws) {
    item.result.drawRank = countLocalCardDraws(db, item.card.id);
    if (!item.result.duplicated) {
      item.result.collectorRank = countLocalCardOwners(db, item.card.id);
    }
  }
}

function todayEvents(db, predicate) {
  const date = today();
  return db.events.filter(event => event.createdAt && todayOf(event.createdAt) === date && predicate(event));
}

function dailyTaskState(user) {
  ensureUserShape(user);
  const date = today();
  const current = user.challengeState.dailyTasks;
  if (!current || current.date !== date) {
    user.challengeState.dailyTasks = { date, packOpens: 0, shares: 0 };
  }
  user.challengeState.dailyTasks.packOpens ||= 0;
  user.challengeState.dailyTasks.shares ||= 0;
  return user.challengeState.dailyTasks;
}

function addDailyTaskProgress(user, key, amount = 1) {
  const state = dailyTaskState(user);
  state[key] = Math.max(0, (state[key] || 0) + amount);
  return state;
}

function dailyTaskRules(user, db) {
  ensureUserShape(user);
  const taskState = dailyTaskState(user);
  const drawCount = taskState.packOpens || 0;
  const shareCount = taskState.shares || 0;
  const collectionCount = Object.keys(user.ownedCards).length;
  return [
    {
      id: "draw3",
      title: "今日抽 3 次卡",
      progress: Math.min(drawCount, 3),
      target: 3,
      reward: "+1 抽卡",
      done: drawCount >= 3,
      drawChances: 1,
      text: "今日抽 3 次卡完成，奖励 1 次抽卡"
    },
    {
      id: "share1",
      title: "完成 1 次分享",
      progress: Math.min(shareCount, 1),
      target: 1,
      reward: "+1 抽卡",
      done: shareCount >= 1,
      drawChances: 1,
      text: "今日分享任务完成，奖励 1 次抽卡"
    },
    {
      id: "collect16",
      title: "收集 16 张不同卡",
      progress: Math.min(collectionCount, 16),
      target: 16,
      reward: "+30 碎片",
      done: collectionCount >= 16,
      scope: "lifetime",
      fragments: 30,
      text: "收集 16 张不同卡完成，奖励 30 碎片"
    },
    {
      id: "pack10",
      title: "累计开包 10 次",
      progress: Math.min(user.openedPacks, 10),
      target: 10,
      reward: "+2 抽卡",
      done: user.openedPacks >= 10,
      scope: "lifetime",
      drawChances: 2,
      text: "累计开包 10 次完成，奖励 2 次抽卡"
    },
    {
      id: "pack30",
      title: "累计开包 30 次",
      progress: Math.min(user.openedPacks, 30),
      target: 30,
      reward: "+4 抽卡",
      done: user.openedPacks >= 30,
      scope: "lifetime",
      drawChances: 4,
      text: "累计开包 30 次完成，奖励 4 次抽卡"
    },
    {
      id: "pack50",
      title: "累计开包 50 次",
      progress: Math.min(user.openedPacks, 50),
      target: 50,
      reward: "+10 抽卡",
      done: user.openedPacks >= 50,
      scope: "lifetime",
      drawChances: 10,
      text: "累计开包 50 次完成，奖励 10 次抽卡"
    }
  ];
}

function taskRewardKey(rule, date = today()) {
  return rule.scope === "lifetime" ? `lifetime:${rule.id}` : `${date}:${rule.id}`;
}

function taskStatus(user, db = null) {
  ensureUserShape(user);
  const date = today();
  return dailyTaskRules(user, db).map(rule => {
    const claimed = rule.done && Boolean(user.taskRewards[taskRewardKey(rule, date)]);
    return {
      id: rule.id,
      title: rule.title,
      progress: rule.progress,
      target: rule.target,
      reward: rule.reward,
      done: rule.done,
      claimed,
      claimable: rule.done && !claimed
    };
  });
}

function claimDailyTask(user, db, taskId) {
  ensureUserShape(user);
  const date = today();
  const rule = dailyTaskRules(user, db).find(item => item.id === taskId);
  if (!rule) return { error: "任务不存在" };
  const key = taskRewardKey(rule, date);
  if (user.taskRewards[key]) return { error: "这个任务已经领取过了" };
  if (!rule.done) return { error: "任务还没有完成" };
  user.taskRewards[key] = true;
  if (rule.drawChances) addDrawChances(user, rule.drawChances);
  if (rule.fragments) user.fragments += rule.fragments;
  return { reward: rule.text };
}

function applySeriesRewards(user) {
  return applyMenuComboRewards(user);
}

function buildSharePayload(body) {
  const scene = String(body.scene || "invite");
  if (scene !== "card" || !isObject(body.highlight)) return {};
  const card = CARDS.find(item => item.id === body.highlight.cardId);
  if (!card || !["legend", "hidden"].includes(card.rarity)) return {};
  const collectorRank = Math.max(0, Number(body.highlight.collectorRank || 0));
  const drawRank = Math.max(0, Number(body.highlight.drawRank || 0));
  return {
    highlight: {
      card,
      collectorRank: collectorRank || null,
      drawRank: drawRank || null
    }
  };
}

function applyMenuComboRewards(user) {
  ensureUserShape(user);
  const rewards = [];
  for (const combo of MENU_COMBOS) {
    if (user.challengeState.menuCombos[combo.id]) continue;
    const completed = combo.cardIds.every(cardId => user.ownedCards[cardId]);
    if (!completed) continue;
    user.challengeState.menuCombos[combo.id] = true;
    if (combo.reward.drawChances) addDrawChances(user, combo.reward.drawChances);
    if (combo.reward.fragments) user.fragments += combo.reward.fragments;
    rewards.push(combo.text);
  }
  return rewards;
}

async function handleMySQL(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/cards") {
      return json(res, 200, { cards: CARDS, series: SERIES, rarities: RARITIES, menuCombos: MENU_COMBOS });
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await parseBody(req);
      const password = String(body.password || "");
      const nickname = normalizeAccount(body.nickname || body.username);
      if (!/^[a-z0-9_\u4e00-\u9fa5]{2,18}$/i.test(nickname) || password.length < 3) {
        return json(res, 400, { message: "账号需 2-18 位，可用中文、字母、数字、下划线；密码至少 3 位" });
      }
      if (await getMysqlPlayerByNickname(nickname)) {
        return json(res, 409, { message: "这个名字已经被注册了，要不再换一个捏" });
      }
      const user = {
        id: id("usr"),
        passwordHash: hash(password),
        nickname,
        score: 0,
        fragments: 0,
        drawChances: 3,
        lastRecoveredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        openedPacks: 0,
        ownedCards: {},
        shareRewards: {},
        taskRewards: {},
        seriesRewards: {},
        milestoneRewards: { score: {}, packs: {} },
        challengeState: {},
        effectState: {}
      };
      const token = id("tok");
      await updateMysqlPlayer(user);
      await setMysqlSession(token, user.id);
      cacheUser(token, user);
      queueMysqlEvent({ type: "register", userId: user.id });
      return json(res, 200, { token, user: userView(user, { drawRecords: [], events: [] }), rewards: ["注册成功，获得 3 次初始抽卡机会"] });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await parseBody(req);
      const nickname = normalizeAccount(body.nickname || body.username);
      const user = await getMysqlPlayerByNickname(nickname);
      if (!user || user.passwordHash !== hash(String(body.password || ""))) {
        return json(res, 401, { message: "账号或密码错误" });
      }
      const token = id("tok");
      recoverDrawChances(user);
      const loginReward = dailyLoginReward(user);
      await updateMysqlPlayer(user);
      await setMysqlSession(token, user.id);
      cacheUser(token, user);
      queueMysqlEvent({ type: "login", userId: user.id });
      const rewards = loginReward ? [`每日登录奖励 +${loginReward} 抽卡机会`] : [];
      return json(res, 200, { token, user: userView(user, { drawRecords: [], events: [] }), rewards });
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const user = await getMysqlUserByToken(req);
      if (!user) return json(res, 401, { message: "请先登录" });
      const recovered = recoverDrawChances(user);
      if (recovered) {
        await updateMysqlPlayer(user);
        await invalidateRankingCache();
      }
      return json(res, 200, { user: await mysqlUserView(user, true), rewards: [] });
    }

    if (req.method === "POST" && url.pathname === "/api/draw") {
      const user = await getMysqlUserByToken(req);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      if (user.challengeState.pendingPack) {
        return json(res, 200, {
          pendingPackId: user.challengeState.pendingPack.id,
          cards: publicPackSlots(user.challengeState.pendingPack.slots),
          user: userView(user, { drawRecords: [], events: [] })
        });
      }
      if (user.drawChances <= 0) return json(res, 400, { message: "抽卡次数不足" });
      user.drawChances -= 1;
      user.openedPacks += 1;
      const pack = createPendingPack(user, 4);
      await updateMysqlPlayer(user);
      await invalidateRankingCache();
      return json(res, 200, {
        pendingPackId: pack.id,
        cards: publicPackSlots(pack.slots),
        user: userView(user, { drawRecords: [], events: [] })
      });
    }

    if (req.method === "POST" && url.pathname === "/api/draw/choose") {
      const user = await getMysqlUserByToken(req);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      const body = await parseBody(req);
      const pack = settlePendingPack(user, body.selectedSlotIds);
      if (pack.error) return json(res, 400, { message: pack.error });
      const openedAt = pack.draws[0]?.drawRecord?.createdAt || new Date().toISOString();
      const packOpenEvent = { type: "pack_open", userId: user.id, createdAt: openedAt };
      const drawEvents = pack.draws.map(item => ({
        type: "draw",
        userId: user.id,
        cardId: item.card.id,
        duplicated: item.result.duplicated,
        createdAt: item.drawRecord.createdAt
      }));
      const [events] = await Promise.all([
        getMysqlTodayUserEvents(user.id),
        insertMysqlEvent(packOpenEvent),
        ...pack.draws.map(item => insertMysqlDrawRecord(item.drawRecord))
      ]);
      drawEvents.forEach(event => queueMysqlEvent(event));
      events.push(packOpenEvent, ...drawEvents);
      addDailyTaskProgress(user, "packOpens", 1);
      const rewards = applyMenuComboRewards(user);
      if (pack.puzzle24.reward) rewards.unshift(pack.puzzle24.reward.text);
      await updateMysqlPlayer(user);
      await attachMysqlCardStats(pack);
      await invalidateRankingCache();
      return json(res, 200, {
        card: { ...pack.highlight.card, point: pack.highlight.point },
        result: pack.highlight.result,
        drawRecord: pack.highlight.drawRecord,
        cards: pack.draws.map(item => ({ ...item.card, slotId: item.slotId, point: item.point })),
        discarded: pack.discarded ? { ...pack.discarded.card, slotId: pack.discarded.slotId, point: pack.discarded.point } : null,
        results: pack.draws.map(item => item.result),
        drawRecords: pack.draws.map(item => item.drawRecord),
        puzzle24: pack.puzzle24,
        rewards,
        user: userView(user, { drawRecords: pack.draws.map(item => item.drawRecord), events })
      });
    }

    if (req.method === "POST" && url.pathname === "/api/exchange") {
      const user = await getMysqlUserByToken(req);
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
      queueMysqlEvent({ type: "exchange", userId: user.id, cardId: card.id });
      const events = await getMysqlTodayUserEvents(user.id);
      const rewards = applyMenuComboRewards(user);
      await updateMysqlPlayer(user);
      await invalidateRankingCache();
      return json(res, 200, { card, rewards, user: userView(user, { drawRecords: [], events }) });
    }

    if (req.method === "POST" && url.pathname === "/api/share/create") {
      const user = await getMysqlUserByToken(req);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      const body = await parseBody(req);
      const scene = String(body.scene || "invite");
      const payload = buildSharePayload(body);
      const share = {
        id: id("shr"),
        userId: user.id,
        nickname: user.nickname,
        scene,
        visits: 0,
        rewarded: false,
        payload,
        createdAt: new Date().toISOString()
      };
      const shareEvent = { type: "share_create", userId: user.id, shareId: share.id, scene, createdAt: share.createdAt };
      await upsertMysqlShare(share);
      addDailyTaskProgress(user, "shares", 1);
      queueMysqlEvent(shareEvent);
      await updateMysqlPlayer(user);
      return json(res, 200, {
        share,
        shareUrl: `../frontend/share.html?shareId=${share.id}`,
        rewards: [],
        user: userView(user, { drawRecords: [], events: [shareEvent] })
      });
    }

    if (req.method === "POST" && url.pathname === "/api/task/claim") {
      const user = await getMysqlUserByToken(req);
      if (!user) return json(res, 401, { message: "请先登录" });
      const body = await parseBody(req);
      const result = claimDailyTask(user, { drawRecords: [], events: [] }, String(body.taskId || ""));
      if (result.error) return json(res, 400, { message: result.error });
      await updateMysqlPlayer(user);
      return json(res, 200, { rewards: [result.reward], user: userView(user, { drawRecords: [], events: [] }) });
    }

    if (req.method === "POST" && url.pathname === "/api/share/visit") {
      const body = await parseBody(req);
      const share = await getMysqlShareById(String(body.shareId || ""));
      if (!share) return json(res, 404, { message: "分享不存在" });
      const owner = await getMysqlPlayerById(share.userId);
      if (!owner) return json(res, 404, { message: "分享者不存在" });
      const viewer = await getMysqlUserByToken(req);
      share.visits += 1;
      const shareEvent = {
        type: "share_visit",
        shareId: share.id,
        userId: viewer?.id || null,
        ownerId: owner.id,
        scene: share.scene,
        rewarded: false,
        createdAt: new Date().toISOString()
      };
      await upsertMysqlShare(share);
      await insertMysqlEvent(shareEvent);
      return json(res, 200, {
        share,
        owner: { nickname: owner.nickname },
        payload: share.payload || {},
        redirect: Boolean(viewer),
        target: "./index.html#homePage",
        reward: null,
        taskRewards: []
      });
    }

    if (req.method === "GET" && url.pathname === "/api/ranking") {
      return json(res, 200, { ranking: await getMysqlRankingRows() });
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      const [users, shares, visits, draws] = await Promise.all([
        mysqlQuery("select count(*) as count from players"),
        mysqlQuery("select count(*) as count from shares"),
        mysqlQuery("select count(*) as count from events where type = 'share_visit'"),
        mysqlQuery("select count(*) as count from draw_records")
      ]);
      return json(res, 200, {
        users: users[0]?.count || 0,
        shares: shares[0]?.count || 0,
        visits: visits[0]?.count || 0,
        draws: draws[0]?.count || 0
      });
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      const rows = await mysqlQuery(
        "select id, nickname, score, fragments, draw_chances, opened_packs, owned_cards from players order by created_at desc"
      );
      const users = await Promise.all(rows.map(async row => ({
        id: row.id,
        nickname: row.nickname,
        score: row.score || 0,
        fragments: row.fragments || 0,
        drawChances: row.draw_chances || 0,
        openedPacks: row.opened_packs || 0,
        collected: Object.keys(parseJsonValue(row.owned_cards, {})).length,
        drawRecords: await getMysqlRecentDrawRecords(row.id, 50)
      })));
      return json(res, 200, { users });
    }

    return json(res, 404, { message: "接口不存在" });
  } catch (error) {
    console.error("接口处理失败：", req.method, url.pathname);
    console.error(error);
    return json(res, 500, { message: "服务器错误", detail: error.message });
  }
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!url.pathname.startsWith("/api/")) return serveStatic(req, res, url);
  if (USE_MYSQL) return handleMySQL(req, res, url);
  const db = await readDb();

  try {
    if (req.method === "GET" && url.pathname === "/api/cards") {
      return json(res, 200, { cards: CARDS, series: SERIES, rarities: RARITIES, menuCombos: MENU_COMBOS });
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await parseBody(req);
      const password = String(body.password || "");
      const nickname = normalizeAccount(body.nickname || body.username);
      if (!/^[a-z0-9_\u4e00-\u9fa5]{2,18}$/i.test(nickname) || password.length < 3) {
        return json(res, 400, { message: "账号需 2-18 位，可用中文、字母、数字、下划线；密码至少 3 位" });
      }
      if (db.users.some(user => user.nickname === nickname)) {
        return json(res, 409, { message: "这个名字已经被注册了，要不再换一个捏" });
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
        seriesRewards: {},
        milestoneRewards: { score: {}, packs: {} },
        challengeState: {},
        effectState: {}
      };
      const token = id("tok");
      db.users.push(user);
      db.sessions[token] = user.id;
      record(db, { type: "register", userId: user.id });
      await writeDb(db);
      return json(res, 200, { token, user: userView(user, db), rewards: ["注册成功，获得 3 次初始抽卡机会"] });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await parseBody(req);
      const nickname = normalizeAccount(body.nickname || body.username);
      const user = db.users.find(item => item.nickname === nickname);
      if (!user || user.passwordHash !== hash(String(body.password || ""))) {
        return json(res, 401, { message: "账号或密码错误" });
      }
      const token = id("tok");
      recoverDrawChances(user);
      const loginReward = dailyLoginReward(user);
      db.sessions[token] = user.id;
      record(db, { type: "login", userId: user.id });
      await writeDb(db);
      const rewards = loginReward ? [`每日登录奖励 +${loginReward} 抽卡机会`] : [];
      return json(res, 200, { token, user: userView(user, db), rewards });
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const user = await getMysqlUserByToken(req);
      if (!user || !user.id) {
        return json(res, 401, { message: "请先登录" });
      }

      recoverDrawChances(user);
      await updateMysqlPlayer(user);

      return json(res, 200, {
        user: await mysqlUserView(user, true),
        rewards: []
      });
    }

    if (req.method === "POST" && url.pathname === "/api/draw") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      if (user.challengeState.pendingPack) {
        return json(res, 200, {
          pendingPackId: user.challengeState.pendingPack.id,
          cards: publicPackSlots(user.challengeState.pendingPack.slots),
          user: userView(user, db)
        });
      }
      if (user.drawChances <= 0) return json(res, 400, { message: "抽卡次数不足" });
      user.drawChances -= 1;
      user.openedPacks += 1;
      const pack = createPendingPack(user, 4);
      await writeDb(db);
      return json(res, 200, {
        pendingPackId: pack.id,
        cards: publicPackSlots(pack.slots),
        user: userView(user, db)
      });
    }

    if (req.method === "POST" && url.pathname === "/api/draw/choose") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      const body = await parseBody(req);
      const pack = settlePendingPack(user, body.selectedSlotIds);
      if (pack.error) return json(res, 400, { message: pack.error });
      db.drawRecords.push(...pack.draws.map(item => item.drawRecord));
      pack.draws.forEach(item => {
        record(db, { type: "draw", userId: user.id, cardId: item.card.id, duplicated: item.result.duplicated });
      });
      record(db, { type: "pack_open", userId: user.id });
      addDailyTaskProgress(user, "packOpens", 1);
      const rewards = applyMenuComboRewards(user);
      if (pack.puzzle24.reward) rewards.unshift(pack.puzzle24.reward.text);
      attachLocalCardStats(pack, db);
      await writeDb(db);
      return json(res, 200, {
        card: { ...pack.highlight.card, point: pack.highlight.point },
        result: pack.highlight.result,
        drawRecord: pack.highlight.drawRecord,
        cards: pack.draws.map(item => ({ ...item.card, slotId: item.slotId, point: item.point })),
        discarded: pack.discarded ? { ...pack.discarded.card, slotId: pack.discarded.slotId, point: pack.discarded.point } : null,
        results: pack.draws.map(item => item.result),
        drawRecords: pack.draws.map(item => item.drawRecord),
        puzzle24: pack.puzzle24,
        rewards,
        user: userView(user, db)
      });
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
      const rewards = applyMenuComboRewards(user);
      await writeDb(db);
      return json(res, 200, { card, rewards, user: userView(user, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/share/create") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      recoverDrawChances(user);
      const body = await parseBody(req);
      const scene = String(body.scene || "invite");
      const payload = buildSharePayload(body);
      const share = {
        id: id("shr"),
        userId: user.id,
        nickname: user.nickname,
        scene,
        visits: 0,
        rewarded: false,
        payload,
        createdAt: new Date().toISOString()
      };
      db.shares.push(share);
      record(db, { type: "share_create", userId: user.id, shareId: share.id, scene, createdAt: share.createdAt });
      addDailyTaskProgress(user, "shares", 1);
      await writeDb(db);
      return json(res, 200, { share, shareUrl: `../frontend/share.html?shareId=${share.id}`, rewards: [], user: userView(user, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/task/claim") {
      const user = currentUser(req, db);
      if (!user) return json(res, 401, { message: "请先登录" });
      const body = await parseBody(req);
      const result = claimDailyTask(user, db, String(body.taskId || ""));
      if (result.error) return json(res, 400, { message: result.error });
      await writeDb(db);
      return json(res, 200, { rewards: [result.reward], user: userView(user, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/share/visit") {
      const body = await parseBody(req);
      const share = db.shares.find(item => item.id === body.shareId);
      if (!share) return json(res, 404, { message: "分享不存在" });
      const owner = db.users.find(user => user.id === share.userId);
      if (!owner) return json(res, 404, { message: "分享者不存在" });
      const viewer = currentUser(req, db);
      share.visits += 1;
      const shareEvent = { type: "share_visit", shareId: share.id, userId: viewer?.id || null, ownerId: owner.id, scene: share.scene, rewarded: false };
      db.events.push({ id: id("evt"), createdAt: new Date().toISOString(), ...shareEvent });
      await writeDb(db);
      return json(res, 200, {
        share,
        owner: { nickname: owner.nickname },
        payload: share.payload || {},
        redirect: Boolean(viewer),
        target: "./index.html#homePage",
        reward: null,
        taskRewards: []
      });
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
    console.error("接口处理失败：", req.method, url.pathname);
    console.error(error);
    return json(res, 500, { message: "服务器错误", detail: error.message });
  }
}

http.createServer(handle).listen(PORT, HOST, () => {
  console.log(`Guangzai backend is running at http://${HOST}:${PORT}`);
});
