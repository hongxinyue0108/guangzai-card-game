const params = new URLSearchParams(window.location.search);
const shareId = params.get("shareId");
const qrImage = document.querySelector("#qrImage");
const returnGame = document.querySelector("#returnGame");

function defaultTargetUrl() {
  return new URL("./index.html", window.location.href).href;
}

function renderQr() {
  const targetUrl = defaultTargetUrl();
  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("size", "260x260");
  qrUrl.searchParams.set("margin", "12");
  qrUrl.searchParams.set("data", targetUrl);
  qrImage.src = qrUrl.href;
}

returnGame.addEventListener("click", () => {
  window.location.href = sessionStorage.getItem("gz_return_to_game") || "./index.html#homePage";
});
renderQr();
