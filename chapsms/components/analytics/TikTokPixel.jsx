const PIXEL_IDS = [
  "D9UJK4BC77UDTFS1RGU0", // Existing pixel
  "DB597OBC77U6DDDLBIT0", // Second pixel
];

const PIXEL_CODE = `
!function (w, d, t) {
  w.TiktokAnalyticsObject = t;
  var ttq = w[t] = w[t] || [];
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  ttq.setAndDefer = function (target, method) {
    target[method] = function () {
      target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (var i = 0; i < ttq.methods.length; i++) {
    ttq.setAndDefer(ttq, ttq.methods[i]);
  }
  ttq.instance = function (id) {
    for (var instance = ttq._i[id] || [], j = 0; j < ttq.methods.length; j++) {
      ttq.setAndDefer(instance, ttq.methods[j]);
    }
    return instance;
  };
  ttq.load = function (id, options) {
    var url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    if (ttq._i[id]) return;
    ttq._i[id] = [];
    ttq._i[id]._u = url;
    ttq._t = ttq._t || {};
    ttq._t[id] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[id] = options || {};
    var script = d.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = url + "?sdkid=" + encodeURIComponent(id) + "&lib=" + t;
    var firstScript = d.getElementsByTagName("script")[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      (d.head || d.documentElement).appendChild(script);
    }
  };
  ${PIXEL_IDS.map((id) => `ttq.load(${JSON.stringify(id)});`).join("\n  ")}
  ttq.page();
}(window, document, "ttq");
`;

export default function TikTokPixel() {
  return (
    <script
      id="tiktok-pixel-base-code"
      dangerouslySetInnerHTML={{ __html: PIXEL_CODE }}
    />
  );
}
