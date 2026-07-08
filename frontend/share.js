const API = "";
const params = new URLSearchParams(window.location.search);
const shareId = params.get("shareId");
const ownerPreview = params.get("from") === "owner";
const returnGame = document.querySelector("#returnGame");
const token = localStorage.getItem("gz_token") || "";

async function visitShare() {
  if (!shareId) {
    document.querySelector("#shareText").textContent = "分享链接缺少 shareId。";
    return;
  }
  if (ownerPreview) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("from");
    document.querySelector("#shareText").textContent = "这是可转发页面。请点右上角「...」发送给朋友或群。";
    document.querySelector("#rewardText").textContent = "每日第一次点击游戏内分享入口时，分享任务奖励已由系统发放。";
    window.history.replaceState(null, "", cleanUrl.href);
    return;
  }
  try {
    const response = await fetch(`${API}/api/share/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ shareId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "分享访问失败");
    if (data.redirect && data.target) {
      window.location.href = data.target;
      return;
    }
    document.querySelector("#shareText").textContent = `你正在访问 ${data.owner.nickname} 的分享页面。`;
    document.querySelector("#rewardText").textContent = "访问已记录。登录后也可以点击游戏内分享入口完成每日分享任务。";
  } catch (error) {
    document.querySelector("#shareText").textContent = error.message;
  }
}

visitShare();
returnGame.addEventListener("click", () => {
  sessionStorage.setItem("gz_after_login_page", "homePage");

  const savedReturn = sessionStorage.getItem("gz_return_to_game");

  if (savedReturn) {
    window.location.href = savedReturn;
    return;
  }

  window.location.href = "./index.html#homePage";
});
