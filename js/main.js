(function () {
  "use strict";

  var REPO = "ali-ghamdan/athar-website";
  var RELEASES_URL = "https://github.com/" + REPO + "/releases";
  var RELEASES_LATEST_URL = RELEASES_URL + "/latest";
  var ASSET_DOWNLOAD_URL = "https://github.com/" + REPO + "/releases/latest/download/";
  var API_LATEST_URL = "https://api.github.com/repos/" + REPO + "/releases/latest";
  var FALLBACK_VERSION = "1448.6.3";
  var VERSION_DISPLAY = "6/3/1448 هـ";
  var CACHE_KEY = "athar_release_cache";
  var CACHE_TTL = 60 * 60 * 1000;
  var IGNORED_SUFFIXES = [".blockmap", ".yml", ".yaml", ".sig", ".sha256", ".txt", ".json"];
  var ARCH_BY_OS = {
    windows: "x64",
    linux: "x64",
    mac: "arm64",
  };
  var FALLBACK_ASSETS = {
    windows: {
      x64: "Athar_" + FALLBACK_VERSION + "_x64-setup.exe",
      arm64: "Athar_" + FALLBACK_VERSION + "_arm64-setup.exe",
    },
    linux: {
      x64: "Athar_" + FALLBACK_VERSION + "_amd64.tar.gz",
      arm64: "Athar_" + FALLBACK_VERSION + "_arm64.tar.gz",
    },
    mac: {
      arm64: "Athar_" + FALLBACK_VERSION + "_aarch64.dmg",
      x64: "Athar_" + FALLBACK_VERSION + "_x64.dmg",
    },
  };

  var detectedOs = detectOs();
  var detectedArch = detectArch();

  function detectOs() {
    var uaData = navigator.userAgentData;
    var platform = (uaData && uaData.platform) || navigator.platform || "";
    var ua = navigator.userAgent || "";
    if (/win/i.test(platform) || /win/i.test(ua)) return "windows";
    if (/mac/i.test(platform) || /mac/i.test(ua)) return "mac";
    if (/linux/i.test(platform) || /linux/i.test(ua)) return "linux";
    return null;
  }

  function detectArch() {
    var uaData = navigator.userAgentData;
    if (uaData && uaData.architecture) {
      return /arm|aarch64/i.test(uaData.architecture) ? "arm64" : "x64";
    }
    var ua = navigator.userAgent || "";
    if (/aarch64|arm64|armv8|arm/i.test(ua)) return "arm64";
    if (/x86_64|amd64|win64|WOW64/i.test(ua)) return "x64";
    return null;
  }

  function isDownloadable(name) {
    var lower = name.toLowerCase();
    return !IGNORED_SUFFIXES.some(function (s) {
      return lower.endsWith(s);
    });
  }

  function osMatch(name, os) {
    var lower = name.toLowerCase();
    if (os === "windows") return /\.(exe|msi)$/.test(lower);
    if (os === "linux") return /\.(appimage|deb|rpm|tar\.gz)$/.test(lower);
    if (os === "mac") return /\.dmg$/.test(lower);
    return false;
  }

  function archMatch(name, os, arch) {
    var lower = name.toLowerCase();
    if (os === "linux") {
      if (arch === "arm64") return /arm64|aarch64/.test(lower);
      if (arch === "x64") return /amd64|x86_64|x64/.test(lower);
    }
    if (os === "mac") {
      if (arch === "arm64") return /aarch64|arm64/.test(lower);
      if (arch === "x64") return /x64|x86_64/.test(lower);
    }
    return true;
  }

  function pickAsset(assets, os, arch) {
    var scored = assets
      .filter(function (a) {
        return isDownloadable(a.name) && osMatch(a.name, os);
      })
      .map(function (a) {
        var score = 0;
        if (archMatch(a.name, os, arch)) score += 2;
        if (/\.exe$/.test(a.name)) score += 1;
        if (/\.msi$/.test(a.name)) score += 0;
        if (/\.tar\.gz$/.test(a.name)) score += 2;
        if (/\.deb$/.test(a.name)) score += 1;
        if (/\.appimage$/.test(a.name)) score += 0;
        if (/\.dmg$/.test(a.name)) score += 1;
        if (/-updater/.test(a.name)) score -= 10;
        return { asset: a, score: score };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });
    return scored.length ? scored[0].asset : null;
  }

  function humanSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    var units = ["بايت", "KB", "MB", "GB"];
    var i = 0;
    var n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    return n.toFixed(i === 0 ? 0 : 1) + " " + units[i];
  }

  function setLink(link, url) {
    if (link && url) link.setAttribute("href", url);
  }

  function versionFromTag(tag) {
    return tag ? tag.replace(/^v/, "") : FALLBACK_VERSION;
  }

  function render(release) {
    var version = versionFromTag(release && release.tag_name);
    var assets = (release && release.assets) || [];
    var meta = version === FALLBACK_VERSION ? "الإصدار " + VERSION_DISPLAY : "الإصدار " + version + " هـ";
    document.getElementById("hero-badge").textContent = "الإصدار " + VERSION_DISPLAY;
    document.getElementById("footer-meta").textContent = meta;

    var primary = document.getElementById("primary-download");
    var osCards = document.querySelectorAll(".os-card");
    var anyMatched = false;

    osCards.forEach(function (card) {
      var os = card.getAttribute("data-os");
      var arch = ARCH_BY_OS[os] || "x64";
      var link = card.querySelector(".os-link");
      var asset = pickAsset(assets, os, arch);
      var url = null;

      if (asset) {
        url = asset.browser_download_url;
        var size = humanSize(asset.size);
        var archLabel = card.querySelector(".os-arch");
        if (archLabel && size) archLabel.textContent = archLabel.textContent + " · " + size;
      } else {
        var fallback = FALLBACK_ASSETS[os] && FALLBACK_ASSETS[os][arch];
        if (fallback) url = ASSET_DOWNLOAD_URL + encodeURIComponent(fallback);
      }
      setLink(link, url);
    });

    var heroAsset = null;
    if (detectedOs && detectedArch) {
      heroAsset = pickAsset(assets, detectedOs, detectedArch);
    }
    var heroUrl = null;
    if (heroAsset) {
      heroUrl = heroAsset.browser_download_url;
    } else if (detectedOs && FALLBACK_ASSETS[detectedOs]) {
      var fb = FALLBACK_ASSETS[detectedOs][detectedArch] || FALLBACK_ASSETS[detectedOs].x64;
      heroUrl = ASSET_DOWNLOAD_URL + encodeURIComponent(fb);
    }
    if (heroUrl) {
      setLink(primary, heroUrl);
      anyMatched = true;
    }
    if (detectedOs && !anyMatched) {
      setLink(primary, RELEASES_URL);
    }
  }

  function renderFallback() {
    render(null);
  }

  function loadRelease() {
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL) {
        render(cached.data);
        return;
      }
    } catch (e) {
      cached = null;
    }

    fetch(API_LATEST_URL, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("api " + res.status);
        return res.json();
      })
      .then(function (data) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (e) {}
        render(data);
      })
      .catch(function () {
        renderFallback();
      });
  }

  function cycleTheme() {
    var states = ["system", "light", "dark"];
    var current = document.documentElement.getAttribute("data-theme") || "system";
    var next = states[(states.indexOf(current) + 1) % states.length];
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    }
  }

  function initTheme() {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", cycleTheme);
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", function (e) {
      if (!localStorage.getItem("theme")) {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    });
  }

  function initLightbox() {
    var overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "عرض الصورة بملء الشاشة");
    var img = document.createElement("img");
    img.alt = "";
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    function open(el) {
      img.src = el.currentSrc || el.src;
      img.alt = el.alt || "";
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function close() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }

    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    document.querySelectorAll(".hero-shot img, .page-shot img").forEach(function (el) {
      el.style.cursor = "zoom-in";
      el.addEventListener("click", function () {
        open(el);
      });
    });
  }

  initTheme();
  initLightbox();
  loadRelease();
})();
