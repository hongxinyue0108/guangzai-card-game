const API = "";
const params = new URLSearchParams(window.location.search);
const shareId = params.get("shareId");
const ownerPreview = params.get("from") === "owner";
const returnGame = document.querySelector("#returnGame");
const copyCurrentLink = document.querySelector("#copyCurrentLink");
const shareCurrentPage = document.querySelector("#shareCurrentPage");

async function visitShare() {
  if (!shareId) {
    document.querySelector("#shareText").textContent = "分享链接缺少 shareId。";
    return;
  }
  if (ownerPreview) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("from");
    document.querySelector("#shareText").textContent = "这是可转发页面。请点右上角「...」发送给朋友或群。";
    document.querySelector("#rewardText").textContent = "好友打开你转发的页面后，系统会记录分享跳转并发放奖励。";
    window.history.replaceState(null, "", cleanUrl.href);
    return;
  }
  try {
    const response = await fetch(`${API}/api/share/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "分享访问失败");
    document.querySelector("#shareText").textContent = `你正在访问 ${data.owner.nickname} 的分享页面。`;
    const taskText = data.taskRewards?.length ? ` ${data.taskRewards.join(" ")}` : "";
    document.querySelector("#rewardText").textContent = data.reward
      ? `${data.owner.nickname} 获得 1 次抽卡机会。${taskText}`
      : `今日该分享场景奖励已领取，访问已记录。${taskText}`;
  } catch (error) {
    document.querySelector("#shareText").textContent = error.message;
  }
}

visitShare();
copyCurrentLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    document.querySelector("#rewardText").textContent = "链接已复制，可以直接粘贴发给好友。";
  } catch {
    window.prompt("复制这个链接发送给好友", window.location.href);
  }
});
shareCurrentPage.addEventListener("click", async () => {
  if (!navigator.share) {
    document.querySelector("#rewardText").textContent = "当前浏览器不支持直接拉起分享，请点右上角「...」分享，或复制链接发送。";
    return;
  }
  try {
    await navigator.share({
      title: "光仔卡牌",
      text: "来抽一张名场面卡。",
      url: window.location.href
    });
  } catch (error) {
    if (error?.name !== "AbortError") {
      document.querySelector("#rewardText").textContent = "没有拉起分享时，请点右上角「...」分享，或复制链接发送。";
    }
  }
});
returnGame.addEventListener("click", () => {
  window.location.href = sessionStorage.getItem("gz_return_to_game") || "./index.html#homePage";
});
