const API = "";

const state = {
  token: localStorage.getItem("gz_token") || "",
  authMode: "login",
  user: null,
  cards: [],
  series: []
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "请求失败");
  return data;
}

function toast(message) {
  $("#modalContent").innerHTML = `<div class="message">${message}</div>`;
  $("#modal").classList.remove("hidden");
}

function rewardHtml(rewards = []) {
  if (!rewards.length) return "";
  return `
    <div class="reward-list">
      <strong>奖励到账</strong>
      ${rewards.map(text => `<p>${text}</p>`).join("")}
    </div>
  `;
}

function cardFace(card, owned = true) {
  if (card.id === "c001" && owned) {
    return `
      <div class="special-card-face image-card-face">
        <img src="./assets/cards/sixue-fansha.png" alt="丝血反杀卡面" />
      </div>
    `;
  }
  return `<div class="card-art">${owned ? card.name.slice(0, 1) : "?"}</div>`;
}

function showCardResult(card, result) {
  const rewards = result.rewards || [];
  const action = ["rare", "epic", "legend", "hidden"].includes(card.rarity)
    ? `<button class="secondary" onclick="shareScene('card')">分享这张卡 · 跳转领奖</button>`
    : "";
  $("#modalContent").innerHTML = `
    <div class="result-showcase">
      <p class="eyebrow">抽取结果</p>
      <div class="card result-card rarity-${card.rarity} ${card.id === "c001" ? "special-result-card" : ""}">
        <div class="card-shine"></div>
        ${cardFace(card)}
        <strong>${card.name}</strong>
        <small>${card.series} · ${card.rarityName}</small>
        <p>${card.quote}</p>
      </div>
    </div>
    <p class="message">${
      result.duplicated
        ? `重复卡已转化为 ${result.fragmentsGained} 碎片`
        : `新卡入册，积分 +${result.scoreGained}`
    }</p>
    ${rewardHtml(rewards)}
    ${action}
  `;
  $("#modal").classList.remove("hidden");
}

function showSharePoster(scene, shareId) {
  const sceneText = {
    invite: "邀请好友来收集名场面",
    rank: "晒出我的排行榜战绩",
    card: "炫耀刚抽到的稀有卡"
  }[scene] || "分享光仔卡牌";
  $("#modalContent").innerHTML = `
    <div class="share-card-preview">
      <p class="eyebrow">分享卡片预览</p>
      <h3>${sceneText}</h3>
      <div class="share-mini-card">
        <span>光仔卡牌</span>
        <strong>名场面召集令</strong>
      </div>
      <p>我在光仔卡牌里打开了名场面之殿，来一起抽一包。</p>
      <small>分享码：${shareId}</small>
    </div>
    <p class="message">演示版会在进入分享页后检测跳转，并给分享者发放奖励。</p>
    <button class="primary" onclick="openPoster('${shareId}')">生成二维码海报</button>
    <button class="secondary" onclick="goShare('${shareId}')">直接模拟跳转领奖</button>
  `;
  $("#modal").classList.remove("hidden");
}

function setAuthMode(mode) {
  state.authMode = mode;
  $("#showLogin").classList.toggle("active", mode === "login");
  $("#showRegister").classList.toggle("active", mode === "register");
  $("#authSubmit").textContent = mode === "login" ? "登录并进入" : "注册并进入";
  $("#authMessage").textContent = "";
}

async function loadCards() {
  const data = await request("/api/cards");
  state.cards = data.cards;
  state.series = data.series;
  $("#albumSeries").innerHTML = state.series.map(name => `<option value="${name}">${name}</option>`).join("");
}

async function loadProfile() {
  const data = await request("/api/profile");
  state.user = data.user;
  render();
}

function render() {
  if (!state.user) {
    $("#authView").classList.remove("hidden");
    $("#gameView").classList.add("hidden");
    return;
  }
  $("#authView").classList.add("hidden");
  $("#gameView").classList.remove("hidden");
  $("#nicknameText").textContent = state.user.nickname;
  $("#drawChances").textContent = state.user.drawChances;
  $("#score").textContent = state.user.score;
  $("#fragments").textContent = state.user.fragments;
  $("#collection").textContent = `${Object.keys(state.user.ownedCards).length}/${state.cards.length}`;
  renderTasks();
  renderSeriesGoals();
  renderAlbum();
  loadRanking();
}

function renderTasks() {
  const tasks = state.user.tasks || [];
  $("#taskList").innerHTML = tasks.map(task => {
    const percent = Math.round((task.progress / task.target) * 100);
    return `
      <div class="task-row ${task.claimed ? "done" : ""}">
        <div>
          <strong>${task.title}</strong>
          <small>${task.progress}/${task.target} · ${task.reward}${task.claimed ? " · 已领取" : ""}</small>
        </div>
        <div class="bar"><span style="width:${percent}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderSeriesGoals() {
  $("#seriesList").innerHTML = state.series.map(series => {
    const cards = state.cards.filter(card => card.series === series);
    const owned = cards.filter(card => state.user.ownedCards[card.id]).length;
    const percent = Math.round((owned / cards.length) * 100);
    const claimed = Boolean(state.user.seriesRewards?.[series]);
    return `
      <div class="series-row ${claimed ? "done" : ""}">
        <div>
          <strong>${series}</strong>
          <small>${owned}/${cards.length}${claimed ? " · 奖励已领取" : ""}</small>
        </div>
        <div class="bar"><span style="width:${percent}%"></span></div>
      </div>
    `;
  }).join("");
}

function cardAction(card, owned) {
  if (owned) return "";
  const disabled = state.user.fragments < card.price;
  return `
    <button class="secondary card-action" ${disabled ? "disabled" : ""} onclick="event.stopPropagation(); exchangeCard('${card.id}')">
      ${card.price} 碎片兑换
    </button>
  `;
}

function cardMarkup(card, owned) {
  if (!owned) {
    return `
      <article class="card locked" onclick="showCardDetail('${card.id}')">
        <div class="locked-card-back">
          <span>?</span>
          <small>未解锁</small>
        </div>
        ${cardAction(card, owned)}
      </article>
    `;
  }
  return `
    <article class="card rarity-${card.rarity} ${card.id === "c001" ? "special-album-card" : ""}" onclick="showCardDetail('${card.id}')">
      ${cardFace(card, true)}
      <strong>${card.name}</strong>
      <small>${card.series} · ${card.rarityName}</small>
      <p>${card.quote}</p>
    </article>
  `;
}

function renderAlbum() {
  const series = $("#albumSeries").value || state.series[0];
  const cards = state.cards.filter(card => card.series === series);
  $("#cardGrid").innerHTML = cards
    .map(card => cardMarkup(card, Boolean(state.user.ownedCards[card.id])))
    .join("");
}

function showCardDetail(cardId) {
  const card = state.cards.find(item => item.id === cardId);
  if (!card) return;
  const owned = Boolean(state.user.ownedCards[card.id]);
  const action = owned ? "" : cardAction(card, owned);
  $("#modalContent").innerHTML = `
    <div class="card-detail">
      <p class="eyebrow">${owned ? "已收录卡牌" : "未解锁卡牌"}</p>
      <div class="detail-visual ${owned ? `rarity-${card.rarity}` : "locked"}">
        ${owned ? cardFace(card, true) : `
          <div class="locked-card-back">
            <span>?</span>
            <small>未解锁</small>
          </div>
        `}
      </div>
      ${owned ? `
        <div class="detail-meta">
          <strong>${card.name}</strong>
          <span>${card.series} · ${card.rarityName} · 积分 ${card.score}</span>
          <p>${card.quote}</p>
        </div>
      ` : `
        <p class="message">消耗 ${card.price} 碎片可解锁这张卡。</p>
        ${action}
      `}
    </div>
  `;
  $("#modal").classList.remove("hidden");
}

async function loadRanking() {
  const data = await request("/api/ranking");
  const rows = data.ranking.length ? data.ranking : [{ rank: 1, nickname: "暂无玩家", score: 0, collected: 0, total: state.cards.length }];
  $("#rankingList").innerHTML = rows.map(row => `
    <div class="rank-row">
      <b>#${row.rank}</b>
      <span>${row.nickname}${row.player ? "（玩家）" : ""}<br><small>${row.collected}/${row.total} 已收集</small></span>
      <strong>${row.score}</strong>
    </div>
  `).join("");
}

async function exchangeCard(cardId) {
  try {
    const data = await request("/api/exchange", {
      method: "POST",
      body: JSON.stringify({ cardId })
    });
    state.user = data.user;
    toast(`兑换成功：${data.card.name}${rewardHtml(data.rewards)}`);
    render();
    showCardDetail(cardId);
  } catch (error) {
    toast(error.message);
  }
}

async function shareScene(scene) {
  try {
    const data = await request("/api/share/create", {
      method: "POST",
      body: JSON.stringify({ scene })
    });
    showSharePoster(scene, data.share.id);
  } catch (error) {
    toast(error.message);
  }
}

window.exchangeCard = exchangeCard;
window.showCardDetail = showCardDetail;
window.shareScene = shareScene;
window.goShare = shareId => {
  window.location.href = `./share.html?shareId=${encodeURIComponent(shareId)}`;
};
window.openPoster = shareId => {
  window.location.href = `./poster.html?shareId=${encodeURIComponent(shareId)}`;
};

async function submitAuth() {
  const nickname = $("#nickname").value.trim();
  const password = $("#password").value;
  try {
    const data = await request(state.authMode === "login" ? "/api/login" : "/api/register", {
      method: "POST",
      body: JSON.stringify({ nickname, password })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("gz_token", state.token);
    render();
  } catch (error) {
    $("#authMessage").textContent = error.message;
  }
}

async function drawCard() {
  try {
    $("#drawBtn").disabled = true;
    $("#drawBtn").textContent = "校验中...";
    const data = await request("/api/draw", { method: "POST" });
    $("#packStage").classList.add("charging");
    $("#crystal").classList.add("opening");
    $("#crystalText").textContent = "？";
    $("#drawBtn").textContent = "晶核共鸣中...";
    await new Promise(resolve => setTimeout(resolve, 1050));
    $("#packStage").classList.remove("charging");
    $("#packStage").classList.add("rarity-phase", "burst", `rarity-phase-${data.card.rarity}`);
    $("#crystal").className = `crystal reveal rarity-glow-${data.card.rarity} rarity-preview-${data.card.rarity}`;
    $("#crystalText").textContent = data.card.rarityName;
    $("#drawBtn").textContent = `${data.card.rarityName}卡响应中...`;
    await new Promise(resolve => setTimeout(resolve, 900));
    $("#packStage").classList.remove("rarity-phase", "burst", `rarity-phase-${data.card.rarity}`);
    $("#crystal").className = "crystal";
    $("#crystalText").textContent = "开";
    $("#drawBtn").disabled = false;
    $("#drawBtn").textContent = "开包";
    state.user = data.user;
    render();
    showCardResult(data.card, { ...data.result, rewards: data.rewards || [] });
  } catch (error) {
    $("#packStage").className = "pack-stage";
    $("#crystal").className = "crystal";
    $("#crystalText").textContent = "开";
    $("#drawBtn").disabled = false;
    $("#drawBtn").textContent = "开包";
    toast(error.message);
  }
}

function bind() {
  $("#showLogin").addEventListener("click", () => setAuthMode("login"));
  $("#showRegister").addEventListener("click", () => setAuthMode("register"));
  $("#authSubmit").addEventListener("click", submitAuth);
  $("#drawBtn").addEventListener("click", drawCard);
  $("#albumInviteBtn").addEventListener("click", async () => {
    try {
      const data = await request("/api/share/create", {
        method: "POST",
        body: JSON.stringify({ scene: "invite" })
      });
      window.location.href = `./poster.html?shareId=${encodeURIComponent(data.share.id)}`;
    } catch (error) {
      toast(error.message);
    }
  });
  $("#shareRankBtn").addEventListener("click", () => shareScene("rank"));
  $("#albumSeries").addEventListener("change", renderAlbum);
  $("#closeModal").addEventListener("click", () => $("#modal").classList.add("hidden"));
  $("#logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("gz_token");
    state.token = "";
    state.user = null;
    render();
  });
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach(item => item.classList.remove("active"));
      $$(".page").forEach(page => page.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.page}`).classList.add("active");
    });
  });
}

async function init() {
  bind();
  setAuthMode("login");
  await loadCards();
  if (state.token) {
    try {
      await loadProfile();
    } catch {
      localStorage.removeItem("gz_token");
      state.token = "";
      render();
    }
  } else {
    render();
  }
}

init();
