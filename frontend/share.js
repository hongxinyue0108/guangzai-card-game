const API = "";
const params = new URLSearchParams(window.location.search);
const shareId = params.get("shareId");

async function visitShare() {
  if (!shareId) {
    document.querySelector("#shareText").textContent = "分享链接缺少 shareId。";
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
