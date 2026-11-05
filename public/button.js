/* HOLD pay button. <script src="https://hihodl.xyz/button.js" data-link="https://hihodl.xyz/pay/…" data-label="Pay with HOLD" data-amount="$40.00" async></script> */
(function () {
  var d = document;
  var S = "display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px 0 14px;border-radius:22px;background:#0D1820;border:1px solid rgba(255,255,255,0.16);color:#FFFFFF;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;text-decoration:none;white-space:nowrap;box-sizing:border-box;cursor:pointer";
  function ok(u) {
    try {
      var x = new URL(u);
      return x.protocol === "https:" && /^(www\.)?hihodl\.xyz$/.test(x.hostname) && /^\/pay\/[^/]+(\/[^/]+)?\/?$/.test(x.pathname);
    } catch (e) {
      return false;
    }
  }
  function phone() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  }
  function draw(s) {
    if (s.getAttribute("data-hold-done")) return;
    s.setAttribute("data-hold-done", "1");
    var url = s.getAttribute("data-link") || "";
    if (!ok(url)) return;
    var label = (s.getAttribute("data-label") || "").trim() || "Pay with HOLD";
    var amount = (s.getAttribute("data-amount") || "").trim();
    var a = d.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("style", S);
    var img = d.createElement("img");
    img.src = "https://hihodl.xyz/favicon.png";
    img.alt = "";
    img.width = img.height = 20;
    img.setAttribute("style", "width:20px;height:20px;border-radius:6px;display:block");
    a.appendChild(img);
    a.appendChild(d.createTextNode(amount ? label + " · " + amount : label));
    a.addEventListener("click", function (e) {
      if (phone()) return;
      var w = 460, h = 760;
      var y = (window.screenY || 0) + ((window.outerHeight || screen.height) - h) / 2;
      var x = (window.screenX || 0) + ((window.outerWidth || screen.width) - w) / 2;
      var p = window.open(url, "hold_pay", "popup=yes,width=" + w + ",height=" + h + ",left=" + Math.max(0, x) + ",top=" + Math.max(0, y));
      if (p) {
        try {
          p.opener = null;
        } catch (err) {}
        e.preventDefault();
      }
    });
    s.parentNode.insertBefore(a, s.nextSibling);
  }
  function all() {
    var list = d.querySelectorAll("script[data-link]");
    for (var i = 0; i < list.length; i++) if (/\/button\.js(\?|$)/.test(list[i].src)) draw(list[i]);
  }
  if (d.currentScript) draw(d.currentScript);
  all();
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", all);
})();
