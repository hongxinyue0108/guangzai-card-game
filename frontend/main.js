const API = "";

const state = {
  token: localStorage.getItem("gz_token") || "",
  authMode: "login",
  user: null,
  cards: [],
  series: [],
  introTimer: null,
  introCountdownTimer: null,
  tourIndex: 0,
  tourSteps: [],
  pendingPack: null,
  selectedPackSlots: []
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

function introKey() {
  return state.user ? `gz_intro_seen_${state.user.id}` : "gz_intro_seen";
}

function tourKey() {
  return state.user ? `gz_tour_seen_${state.user.id}` : "gz_tour_seen";
}

function maybeStartOnboarding() {
  if (!state.user) return;
  if (!localStorage.getItem(introKey())) {
    setTimeout(startIntro, 150);
    return;
  }
  if (!localStorage.getItem(tourKey())) setTimeout(startTour, 150);
}

function startIntro() {
  document.body.classList.add("intro-active");
  const scenes = [
    {
      title: "宇宙深处，有一座殿堂",
      text: "它由无数玩家的笑声、怒吼、叹息和尖叫堆砌而成，名字叫作「名场面之殿」。"
    },
    {
      title: "这里只有永恒的一瞬间",
      text: "一次离谱的翻盘，一句传遍社区的梗，一个让策划连夜发道歉信的 BUG，都像星辰一样漂浮在穹顶之上。"
    },
    {
      title: "你是被选中的拾忆者",
      text: "每打开一枚记忆晶核，你就从时间的尘埃中捞回一个值得被记住的瞬间。"
    },
    {
      title: "名场面之柱正在等待你的名字",
      text: "殿堂深处的石柱刻满先行者的名字，而你，刚刚推开了那扇门。"
    }
  ];
  let sceneIndex = 0;
  let skipCountdown = 3;
  const overlay = $("#introOverlay");
  const skip = $("#introSkip");
  overlay.classList.remove("hidden");
  skip.disabled = true;
  skip.textContent = "3 秒后可跳过";

  const renderScene = () => {
    const scene = scenes[Math.min(sceneIndex, scenes.length - 1)];
    $("#introTitle").textContent = scene.title;
    $("#introText").textContent = scene.text;
  };

  renderScene();
  state.introCountdownTimer = setInterval(() => {
    skipCountdown -= 1;
    if (skipCountdown > 0) {
      skip.textContent = `${skipCountdown} 秒后可跳过`;
      return;
    }
    clearInterval(state.introCountdownTimer);
    state.introCountdownTimer = null;
    skip.disabled = false;
    skip.textContent = "跳过";
  }, 1000);

  const sceneTimer = setInterval(() => {
    sceneIndex += 1;
    renderScene();
  }, 3600);

  state.introTimer = setTimeout(() => finishIntro(sceneTimer), 15000);
  skip.onclick = () => {
    if (!skip.disabled) finishIntro(sceneTimer);
  };
}

function finishIntro(sceneTimer = null) {
  if (sceneTimer) clearInterval(sceneTimer);
  if (state.introTimer) clearTimeout(state.introTimer);
  if (state.introCountdownTimer) clearInterval(state.introCountdownTimer);
  state.introTimer = null;
  state.introCountdownTimer = null;
  localStorage.setItem(introKey(), "1");
  $("#introOverlay").classList.add("hidden");
  document.body.classList.remove("intro-active");
  startTour();
}

function buildTourSteps() {
  return [
    { key: "draws", title: "抽卡次数", text: "抽卡次数用来开启记忆晶核。注册初始获得 3 次；之后每日首次登录 +3，也能通过点击分享入口、积分档位、累计开包和 24 点成功获得。" },
    { key: "score", title: "积分", text: "积分是排行榜核心。抽到新卡会提升积分，达到积分档位还会奖励抽卡次数。" },
    { key: "collection", title: "收集", text: "收集表示你已经解锁的卡牌数量。馆藏共 54 张，收集越多，积分、系列奖励和排行榜竞争力都会更高。" },
    { key: "fragments", title: "碎片", text: "碎片用于在卡册中兑换未解锁卡牌。重复卡也会自动转化为碎片。" },
    { key: "pack", title: "记忆晶核", text: "这里开包抽取 4 张名场面卡。每张卡会显示点数，选出的 3 张能凑出 24 点时返还 1 次抽卡机会。" },
    { key: "album", title: "卡册", text: "卡册是你的梗档案馆。收集新卡会增加积分、提升排行榜名次；集齐一个系列还能领取额外抽卡次数和碎片。" },
    { key: "rank", title: "排行榜", text: "排行榜主要按积分排序。想提升排行，就多开包、收集高价值新卡，并用碎片补齐卡册。" },
    { key: "disclaimer", title: "展示说明", text: "本游戏为光核训练营作业展示，仅用于技术交流与测试，非商业运营产品，不涉及充值盈利。账号和密码仅用于保存你的游戏进度，方便再次登录。" }
  ];
}

function showPage(pageId) {
  $$(".tab").forEach(item => item.classList.toggle("active", item.dataset.page === pageId));
  $$(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
  if (pageId === "rankPage") loadRanking();
}

function startTour(force = false) {
  if (!state.user || (!force && localStorage.getItem(tourKey()))) return;
  showPage("homePage");
  document.body.classList.add("tour-active");
  document.body.classList.add("tour-hide-tabs");
  $("#modal").classList.add("hidden");
  state.tourSteps = buildTourSteps();
  state.tourIndex = 0;
  $("#tourOverlay").classList.remove("hidden");
  renderTourStep();
}

function updateTourTabVisibility(step) {
  const shouldShowTabs = ["album", "rank"].includes(step.key);
  document.body.classList.toggle("tour-hide-tabs", !shouldShowTabs);
}

function renderTourStep() {
  const step = state.tourSteps[state.tourIndex];
  if (!step) return finishTour();
  updateTourTabVisibility(step);
  if (step.key === "album") showPage("albumPage");
  if (step.key === "rank") showPage("rankPage");
  const target = document.querySelector(`[data-tour="${step.key}"]`);
  if (!target && step.key !== "disclaimer") return finishTour();
  if (!target && step.key === "disclaimer") {
    $("#tourSpotlight").classList.add("hidden");
    const card = $("#tourCard");
    card.classList.add("standalone");
    card.style.top = "50%";
    card.style.bottom = "auto";
    $("#tourStep").textContent = `${state.tourIndex + 1}/${state.tourSteps.length}`;
    $("#tourTitle").textContent = step.title;
    $("#tourText").textContent = step.text;
    $("#tourNext").textContent = "我知道了";
    return;
  }
  $("#tourSpotlight").classList.remove("hidden");
  $("#tourCard").classList.remove("standalone");
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => {
    const rect = target.getBoundingClientRect();
    const pad = 8;
    const spotlight = $("#tourSpotlight");
    spotlight.style.left = `${Math.max(8, rect.left - pad)}px`;
    spotlight.style.top = `${Math.max(8, rect.top - pad)}px`;
    spotlight.style.width = `${Math.min(window.innerWidth - 16, rect.width + pad * 2)}px`;
    spotlight.style.height = `${rect.height + pad * 2}px`;

    const card = $("#tourCard");
    const placeBelow = rect.top < window.innerHeight * 0.52;
    const cardHeight = Math.min(card.scrollHeight || 190, window.innerHeight - 36);
    const gap = 18;
    if (placeBelow) {
      card.style.top = `${Math.max(18, Math.min(window.innerHeight - cardHeight - gap, rect.bottom + gap))}px`;
      card.style.bottom = "auto";
    } else {
      card.style.top = "auto";
      card.style.bottom = `${Math.max(18, Math.min(window.innerHeight - cardHeight - gap, window.innerHeight - rect.top + gap))}px`;
    }

    $("#tourStep").textContent = `${state.tourIndex + 1}/${state.tourSteps.length}`;
    $("#tourTitle").textContent = step.title;
    $("#tourText").textContent = step.text;
    $("#tourNext").textContent = state.tourIndex === state.tourSteps.length - 1 ? "完成指引" : "下一步";
  }, 260);
}

function nextTourStep() {
  state.tourIndex += 1;
  if (state.tourIndex >= state.tourSteps.length) return finishTour();
  renderTourStep();
}

function finishTour() {
  localStorage.setItem(tourKey(), "1");
  $("#tourOverlay").classList.add("hidden");
  document.body.classList.remove("tour-active");
  document.body.classList.remove("tour-hide-tabs");
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
  return `<div class="card-art">${owned ? '<span class="card-art-mark"></span>' : "?"}</div>`;
}

function cardMeta(card) {
  const source = card.source ? `<span class="source-badge">${card.source}</span>` : "";
  return `<small class="card-meta">${source}<span>${card.series} · ${card.rarityName}</span></small>`;
}

function showPackChoiceResult(packData) {
  const cards = packData.cards || [];
  state.pendingPack = { id: packData.pendingPackId, cards };
  state.selectedPackSlots = [];
  $("#modalContent").innerHTML = `
    <div class="result-showcase">
      <p class="eyebrow">四张候选卡</p>
      <h3>选择 3 张放入卡册</h3>
      <p class="message">点数会用于 24 点判定。未选择的 1 张会被丢弃，不进入卡册。</p>
      <div class="pack-result-grid">
        ${cards.map(item => `
          <button class="card result-card pack-result-card pack-choice-card rarity-${item.rarity}" onclick="togglePackChoice('${item.slotId}')">
            <span class="point-badge">${item.point || "?"}</span>
            <span class="choice-mark">未选</span>
            <div class="card-shine"></div>
            ${cardFace(item)}
            <strong>${item.name}</strong>
            ${cardMeta(item)}
            <p>${item.quote}</p>
          </button>
        `).join("")}
      </div>
    </div>
    <button id="confirmPackChoiceBtn" class="primary large" disabled onclick="submitPackChoice()">确认入册 0/3</button>
  `;
  $("#modal").classList.remove("hidden");
}

function renderPackChoiceState() {
  $$(".pack-choice-card").forEach(card => {
    const onclick = card.getAttribute("onclick") || "";
    const slotId = onclick.match(/'([^']+)'/)?.[1];
    const selected = state.selectedPackSlots.includes(slotId);
    card.classList.toggle("selected", selected);
    const mark = card.querySelector(".choice-mark");
    if (mark) mark.textContent = selected ? "入册" : "未选";
  });
  const button = $("#confirmPackChoiceBtn");
  if (button) {
    button.disabled = state.selectedPackSlots.length !== 3;
    button.textContent = `确认入册 ${state.selectedPackSlots.length}/3`;
  }
}

function togglePackChoice(slotId) {
  const index = state.selectedPackSlots.indexOf(slotId);
  if (index >= 0) {
    state.selectedPackSlots.splice(index, 1);
  } else if (state.selectedPackSlots.length < 3) {
    state.selectedPackSlots.push(slotId);
  } else {
    toast("只能选择 3 张放入卡册，先取消一张再选新的。");
  }
  renderPackChoiceState();
}

async function submitPackChoice() {
  if (state.selectedPackSlots.length !== 3) return;
  try {
    $("#confirmPackChoiceBtn").disabled = true;
    $("#confirmPackChoiceBtn").textContent = "入册结算中...";
    const data = await request("/api/draw/choose", {
      method: "POST",
      body: JSON.stringify({ selectedSlotIds: state.selectedPackSlots })
    });
    state.pendingPack = null;
    state.selectedPackSlots = [];
    applyServerUser(data.user);
    showCardResult(data.card, { ...data.result, rewards: data.rewards || [] }, data);
  } catch (error) {
    toast(error.message);
    renderPackChoiceState();
  }
}

function showCardResult(card, result, packData = null) {
  const cards = packData?.cards?.length ? packData.cards : [card];
  const results = packData?.results?.length ? packData.results : [result];
  const puzzle24 = packData?.puzzle24 || null;
  const rewards = result.rewards || [];
  const hasShareCard = cards.some(item => ["rare", "epic", "legend", "hidden"].includes(item.rarity));
  const action = hasShareCard
    ? `<button class="secondary" onclick="shareScene('card')">分享这张卡 · 领取任务奖励</button>`
    : "";
  const totalScore = results.reduce((sum, item) => sum + (item.scoreGained || 0), 0);
  const totalFragments = results.reduce((sum, item) => sum + (item.fragmentsGained || 0), 0);
  const newCount = results.filter(item => !item.duplicated).length;
  const duplicateCount = results.filter(item => item.duplicated).length;
  $("#modalContent").innerHTML = `
    <div class="result-showcase">
      <p class="eyebrow">入册结算</p>
      <div class="pack-result-grid">
        ${cards.map((item, index) => `
          <div class="card result-card pack-result-card rarity-${item.rarity}">
            <span class="point-badge">${item.point || "?"}</span>
            <div class="card-shine"></div>
            ${cardFace(item)}
            <strong>${item.name}</strong>
            ${cardMeta(item)}
            <p>${results[index]?.duplicated ? `重复 +${results[index].fragmentsGained} 碎片` : `新卡 +${results[index]?.scoreGained || 0} 积分`}</p>
          </div>
        `).join("")}
      </div>
    </div>
    ${puzzle24 ? `
      <div class="puzzle-summary ${puzzle24.success ? "success" : "failed"}">
        <strong>${puzzle24.success ? "24 点判定成功" : "本次未凑出 24 点"}</strong>
        <p>${puzzle24.success ? `${puzzle24.formula} = 24，返还 1 次抽卡机会。` : `从点数 ${puzzle24.points.join("、")} 中选 3 张暂时无解。`}</p>
      </div>
    ` : ""}
    ${packData?.discarded ? `<p class="message">已丢弃：${packData.discarded.name}（${packData.discarded.point} 点），未进入卡册。</p>` : ""}
    <p class="message">本次入册 ${newCount} 张新卡、${duplicateCount} 张重复卡；积分 +${totalScore}，碎片 +${totalFragments}。</p>
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
  const shareUrl = shareLink(shareId);
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
    <p class="disclaimer compact">本游戏为光核训练营作业展示，仅用于技术交流与测试，非商业运营产品，不涉及充值盈利。</p>
    <p class="message">点击分享入口会完成每日分享任务并发放奖励。微信/QQ 内置浏览器请按页面提示用右上角菜单转发。</p>
    <div class="share-actions">
      <button class="primary" onclick="nativeShare('${shareId}', '${scene}')">转发/分享</button>
      <button class="secondary" onclick="openSharePage('${shareId}')">打开可转发页面</button>
      <button class="secondary" onclick="copyShareLink('${shareId}')">复制分享链接</button>
    </div>
    <p class="share-link-text">${shareUrl}</p>
  `;
  $("#modal").classList.remove("hidden");
}

function shareLink(shareId) {
  return new URL(`./share.html?shareId=${encodeURIComponent(shareId)}`, window.location.href).href;
}

function gameHomeUrl() {
  return new URL("./index.html#homePage", window.location.href).href;
}

function rememberShareReturn() {
  sessionStorage.setItem("gz_return_to_game", gameHomeUrl());
}

function shareEnv() {
  const ua = navigator.userAgent.toLowerCase();
  if (/micromessenger/.test(ua)) return "wechat";
  if (/\bqq\//.test(ua) || /mqqbrowser/.test(ua)) return "qq";
  return "browser";
}

function openSharePage(shareId) {
  rememberShareReturn();
  window.location.href = `./share.html?shareId=${encodeURIComponent(shareId)}&from=owner`;
}

function showShareGuide(shareId, scene = "invite") {
  const env = shareEnv();
  const envName = env === "wechat" ? "微信" : env === "qq" ? "QQ" : "当前浏览器";
  const shareUrl = shareLink(shareId);
  $("#modalContent").innerHTML = `
    <div class="share-card-preview">
      <p class="eyebrow">${envName}分享方式</p>
      <h3>用右上角菜单转发</h3>
      <div class="share-mini-card">
        <span>分享码</span>
        <strong>${shareId}</strong>
      </div>
      <p>${envName}里如果不能直接弹出好友列表，请先打开可转发页面，再点右上角「...」选择发送给朋友/分享到群。</p>
    </div>
    <div class="share-steps">
      <p><strong>方式一：</strong>打开可转发页面，然后点右上角「...」转发。</p>
      <p><strong>方式二：</strong>复制链接，手动粘贴发送。</p>
    </div>
    <div class="share-actions">
      <button class="primary" onclick="openSharePage('${shareId}')">打开可转发页面</button>
      <button class="secondary" onclick="copyShareLink('${shareId}')">复制链接</button>
    </div>
    <p class="share-link-text">${shareUrl}</p>
  `;
  $("#modal").classList.remove("hidden");
}

async function copyShareLink(shareId) {
  const url = shareLink(shareId);
  try {
    await navigator.clipboard.writeText(url);
    toast("分享链接已复制，可以粘贴发给好友。");
  } catch {
    window.prompt("复制这个分享链接", url);
  }
}

async function nativeShare(shareId, scene = "invite") {
  const title = {
    invite: "来光仔卡牌收集名场面",
    rank: "我在光仔卡牌冲榜了",
    card: "我抽到了光仔卡牌名场面"
  }[scene] || "光仔卡牌";
  const url = shareLink(shareId);
  const payload = {
    title,
    text: "推开名场面之殿，开一枚记忆晶核，看看你能捞回哪个游戏瞬间。",
    url
  };
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  showShareGuide(shareId, scene);
}

function showHelpGuide() {
  $("#modalContent").innerHTML = `
    <div class="guide">
      <p class="eyebrow">玩法说明</p>
      <h3>拾忆者行动手册</h3>
      <p class="guide-lead">主线目标是通过凑24点和完成任务获得抽卡机会，开启记忆晶核，解锁更多名场面卡牌，并冲上排行榜巅峰！</p>
      <div class="guide-grid">
        <div>
          <strong>抽卡次数</strong>
          <p>用于开启记忆晶核。注册初始获得 3 次；之后每日首次登录 +3，也可通过点击分享入口、积分档位、累计开包返还和 24 点成功获得。</p>
        </div>
        <div>
          <strong>积分</strong>
          <p>排行榜核心指标。抽到新卡会提高积分，稀有度越高积分越多。</p>
        </div>
        <div>
          <strong>收集</strong>
          <p>表示你已经解锁的卡牌数量。馆藏共 54 张，收集越多，积分、系列奖励和排行榜竞争力都会更高。</p>
        </div>
        <div>
          <strong>碎片</strong>
          <p>用于在卡册兑换未解锁卡牌。抽到重复卡时，也会自动转化为碎片。</p>
        </div>
      </div>
      
      <div class="guide-ranking">
        <strong>24点判定</strong>
        <p>每次开包得到的 4 张卡都会显示点数。你需要选择 3 张放入卡册；若选中的 3 张能用加减乘除凑出 24 点，才会返还 1 次抽卡机会。</p>
      </div>
      <div class="guide-ranking">
        <strong>排行榜怎么算？</strong>
        <p>排行榜主要按积分排序。想提升排名，就获取更多抽卡次数、解锁高价值新卡，并利用碎片补齐卡册。</p>
      </div>
      <div class="guide-ranking">
        <strong>抽卡次数怎么变多？</strong>
        <p>注册初始获得 3 次；之后每日首次登录 +3。每天第一次点击任意分享入口、累计开包 3 次、积分/开包里程碑、以及选中的 3 张卡成功凑出 24 点，都会奖励抽卡次数。</p>
      </div>
      <div class="guide-ranking">
        <strong>里程碑奖励</strong>
        <p>积分达到 100、260、520、900，或累计开包达到 5、10、20、35，会自动领取阶段奖励；部分档位还会附带碎片。</p>
      </div>
    </div>
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
  applyServerUser(data.user);
}

function applyServerUser(user) {
  if (!user) return;
  state.user = user;
  render();
}

let profileSyncing = false;

async function syncProfile({ silent = true } = {}) {
  if (!state.token || profileSyncing) return;
  profileSyncing = true;
  try {
    const data = await request("/api/profile");
    applyServerUser(data.user);
    if (!silent && data.rewards?.length) data.rewards.forEach(reward => toast(reward));
  } catch (error) {
    if (!silent) toast(error.message);
    if (/请先登录|401/.test(error.message)) {
      localStorage.removeItem("gz_token");
      state.token = "";
      state.user = null;
      render();
    }
  } finally {
    profileSyncing = false;
  }
}

function render() {
  if (!state.user) {
    $("#authView").classList.remove("hidden");
    $("#gameView").classList.add("hidden");
    return;
  }
  $("#authView").classList.add("hidden");
  $("#gameView").classList.remove("hidden");
  if (window.location.hash === "#homePage") {
    showPage("homePage");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  $("#nicknameText").textContent = state.user.nickname;
  $("#drawChances").textContent = state.user.drawChances;
  $("#score").textContent = state.user.score;
  $("#fragments").textContent = state.user.fragments;
  $("#collection").textContent = `${Object.keys(state.user.ownedCards).length}/${state.cards.length}`;
  renderTasks();
  renderSeriesGoals();
  renderAlbum();
  if ($("#rankPage").classList.contains("active")) loadRanking();
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
    <article class="card rarity-${card.rarity}" onclick="showCardDetail('${card.id}')">
      ${cardFace(card, true)}
      <strong>${card.name}</strong>
      ${cardMeta(card)}
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
          <span>${card.source ? `${card.source} · ` : ""}${card.series} · ${card.rarityName} · 积分 ${card.score}</span>
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
    toast(`兑换成功：${data.card.name}${rewardHtml(data.rewards)}`);
    applyServerUser(data.user);
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
    applyServerUser(data.user);
    (data.rewards || []).forEach(reward => toast(reward));
    showSharePoster(scene, data.share.id);
  } catch (error) {
    toast(error.message);
  }
}

window.exchangeCard = exchangeCard;
window.showCardDetail = showCardDetail;
window.togglePackChoice = togglePackChoice;
window.submitPackChoice = submitPackChoice;
window.nextTourStep = nextTourStep;
window.finishTour = finishTour;
window.shareScene = shareScene;
window.nativeShare = nativeShare;
window.copyShareLink = copyShareLink;
window.openSharePage = openSharePage;
window.goShare = shareId => {
  rememberShareReturn();
  window.location.href = `./share.html?shareId=${encodeURIComponent(shareId)}`;
};
window.openPoster = shareId => {
  rememberShareReturn();
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
    applyServerUser(data.user);
    localStorage.setItem("gz_token", state.token);
    if (data.rewards?.length) {
      data.rewards.forEach(reward => toast(reward));
    }
    maybeStartOnboarding();
  } catch (error) {
    $("#authMessage").textContent = error.message;
  }
}

async function drawCard() {
  try {
    $("#drawBtn").disabled = true;
    $("#drawBtn").textContent = "校验中...";
    const data = await request("/api/draw", { method: "POST" });
    applyServerUser(data.user);
    $("#packStage").classList.add("charging");
    $("#crystal").classList.add("opening");
    $("#crystalText").textContent = "";
    $("#drawBtn").textContent = "晶核共鸣中...";
    await new Promise(resolve => setTimeout(resolve, 1050));
    const previewCard = (data.cards || []).reduce((best, item) => {
      const score = { normal: 1, rare: 2, epic: 3, legend: 4, hidden: 5 }[item.rarity] || 0;
      const bestScore = best ? ({ normal: 1, rare: 2, epic: 3, legend: 4, hidden: 5 }[best.rarity] || 0) : -1;
      return score > bestScore ? item : best;
    }, null) || { rarity: "normal", rarityName: "候选" };
    $("#packStage").classList.remove("charging");
    $("#packStage").classList.add("rarity-phase", "burst", `rarity-phase-${previewCard.rarity}`);
    $("#crystal").className = `crystal reveal rarity-glow-${previewCard.rarity} rarity-preview-${previewCard.rarity}`;
    $("#crystalText").textContent = "";
    $("#drawBtn").textContent = "候选卡响应中...";
    await new Promise(resolve => setTimeout(resolve, 900));
    $("#packStage").classList.remove("rarity-phase", "burst", `rarity-phase-${previewCard.rarity}`);
    $("#crystal").className = "crystal";
    $("#crystalText").textContent = "";
    $("#drawBtn").disabled = false;
    $("#drawBtn").textContent = "开包";
    showPackChoiceResult(data);
  } catch (error) {
    $("#packStage").className = "pack-stage";
    $("#crystal").className = "crystal";
    $("#crystalText").textContent = "";
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
  $("#albumInviteBtn").addEventListener("click", () => shareScene("invite"));
  $("#shareRankBtn").addEventListener("click", () => shareScene("rank"));
  $("#albumSeries").addEventListener("change", renderAlbum);
  $("#closeModal").addEventListener("click", () => $("#modal").classList.add("hidden"));
  $("#tourNext").addEventListener("click", nextTourStep);
  $("#helpBtn").addEventListener("click", showHelpGuide);
  $("#logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("gz_token");
    state.token = "";
    state.user = null;
    render();
  });
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => showPage(tab.dataset.page));
  });
  window.addEventListener("pageshow", () => syncProfile());
  window.addEventListener("focus", () => syncProfile());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncProfile();
  });
}

async function init() {
  bind();
  setAuthMode("login");
  await loadCards();
  if (state.token) {
    try {
      await loadProfile();
      maybeStartOnboarding();
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
