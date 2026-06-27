const params = new URLSearchParams(window.location.search);
const shareId = params.get("shareId");
const input = document.querySelector("#targetUrl");
const qrImage = document.querySelector("#qrImage");

function defaultTargetUrl() {
  const target = shareId
    ? `./share.html?shareId=${encodeURIComponent(shareId)}`
    : "./index.html";
  return new URL(target, window.location.href).href;
}

function renderQr() {
  const targetUrl = input.value.trim() || defaultTargetUrl();
  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("size", "260x260");
  qrUrl.searchParams.set("margin", "12");
  qrUrl.searchParams.set("data", targetUrl);
  qrImage.src = qrUrl.href;
}

input.value = defaultTargetUrl();
document.querySelector("#refreshQr").addEventListener("click", renderQr);
renderQr();
