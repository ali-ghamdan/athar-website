(function () {
  "use strict";

  var REPO = "ali-ghamdan/athar-website";
  var RELEASES_URL = "https://github.com/" + REPO + "/releases";
  var ASSET_DOWNLOAD_URL = "https://github.com/" + REPO + "/releases/latest/download/";
  var API_LATEST_URL = "https://api.github.com/repos/" + REPO + "/releases/latest";
  var FALLBACK_VERSION = "1448.8.3";
  var VERSION_DISPLAY = "8/3/1448 هـ";
  var CACHE_KEY = "athar_release_cache";
  var CACHE_TTL = 10 * 60 * 1000;
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
  var ARCH_LABELS = { x64: "x64", arm64: "ARM64" };
  var KIND_ORDER = [
    "windows-setup",
    "mac-dmg",
    "linux-targz",
    "linux-deb",
    "linux-rpm",
    "linux-appimage",
    "windows-exe",
    "other",
  ];

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

  function archFromName(name) {
    if (/arm64|aarch64/i.test(name)) return "arm64";
    if (/amd64|x86_64|x64/i.test(name)) return "x64";
    return null;
  }

  function archMatch(name, os, arch) {
    var lower = name.toLowerCase();
    if (os === "windows") {
      if (arch === "arm64") return /arm64/.test(lower);
      if (arch === "x64") return /x64|amd64|x86_64/.test(lower);
    }
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
        if (/setup\.exe$/.test(a.name)) score += 3;
        if (/\.tar\.gz$/.test(a.name)) score += 2;
        if (/\.dmg$/.test(a.name)) score += 1;
        if (/\.deb$/.test(a.name)) score += 1;
        if (/\.rpm$/.test(a.name)) score += 0;
        if (/\.appimage$/.test(a.name)) score += 0;
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

  function versionLabel(version) {
    return version === FALLBACK_VERSION ? VERSION_DISPLAY : version;
  }

  function describeAsset(name) {
    var lower = name.toLowerCase();
    var kind = "other";
    var label = null;
    if (/setup\.exe$/.test(lower)) kind = "windows-setup", label = "Windows installer";
    else if (/\.dmg$/.test(lower)) kind = "mac-dmg", label = ".dmg";
    else if (/\.tar\.gz$/.test(lower)) kind = "linux-targz", label = ".tar.gz archive";
    else if (/\.deb$/.test(lower)) kind = "linux-deb", label = ".deb (Debian/Ubuntu)";
    else if (/\.rpm$/.test(lower)) kind = "linux-rpm", label = ".rpm (Fedora/SUSE)";
    else if (/\.appimage$/.test(lower)) kind = "linux-appimage", label = ".AppImage (portable)";
    else if (/\.exe$/.test(lower)) kind = "windows-exe", label = ".exe";
    return { kind: kind, label: label, arch: archFromName(name) };
  }

  function renderCard(os, assets) {
    var card = document.querySelector('.os-card[data-os="' + os + '"]');
    if (!card) return;
    var arch = ARCH_BY_OS[os] || "x64";
    var link = card.querySelector(".os-download");
    var more = card.querySelector(".os-more");
    var drop = card.querySelector(".os-drop");
    var list = card.querySelector(".os-drop-list");
    var meta = card.querySelector(".os-primary-meta");
    var osAssets = (assets || []).filter(function (a) {
      return isDownloadable(a.name) && osMatch(a.name, os);
    });
    var primary = pickAsset(osAssets, os, arch);
    var fallback =
      !primary && FALLBACK_ASSETS[os] && FALLBACK_ASSETS[os][arch]
        ? ASSET_DOWNLOAD_URL + encodeURIComponent(FALLBACK_ASSETS[os][arch])
        : null;

    if (primary) {
      setLink(link, primary.browser_download_url);
      var d = describeAsset(primary.name);
      var labelText = d.label ? d.label : primary.name;
      labelText += " " + (d.arch ? (d.arch === "arm64" ? "ARM64" : "x64") : ARCH_LABELS[arch]);
      link.querySelector(".os-download-label").textContent = labelText;
      var size = humanSize(primary.size);
      meta.textContent = size;
      meta.hidden = !size;
    } else if (fallback) {
      setLink(link, fallback);
      link.querySelector(".os-download-label").textContent = ARCH_LABELS[arch];
      meta.textContent = "";
      meta.hidden = true;
    } else {
      setLink(link, RELEASES_URL);
      meta.textContent = "";
      meta.hidden = true;
    }

    var rest = osAssets.filter(function (a) {
      return a !== primary;
    });
    rest.sort(function (a, b) {
      var da = describeAsset(a.name);
      var db = describeAsset(b.name);
      var ia = KIND_ORDER.indexOf(da.kind);
      var ib = KIND_ORDER.indexOf(db.kind);
      if (ia !== ib) return ia - ib;
      var ma = archMatch(a.name, os, arch) ? 1 : 0;
      var mb = archMatch(b.name, os, arch) ? 1 : 0;
      if (ma !== mb) return mb - ma;
      return (b.size || 0) - (a.size || 0);
    });

    list.innerHTML = "";
    rest.forEach(function (a) {
      var d = describeAsset(a.name);
      var li = document.createElement("li");
      var el = document.createElement("a");
      el.href = a.browser_download_url;
      el.target = "_blank";
      el.rel = "noopener";
      var bdi = document.createElement("bdi");
      var text = d.label ? d.label : a.name;
      if (d.arch) text += " · " + (d.arch === "arm64" ? "ARM64" : "x64");
      bdi.textContent = text;
      el.appendChild(bdi);
      var size = humanSize(a.size);
      if (size) {
        var span = document.createElement("span");
        span.className = "extra-size";
        span.textContent = size;
        el.appendChild(span);
      }
      li.appendChild(el);
      list.appendChild(li);
    });

    more.hidden = rest.length === 0;
    if (more.hidden) drop.hidden = true;
  }

  function closeDrops() {
    document.querySelectorAll(".os-card").forEach(function (card) {
      card.classList.remove("open");
      card.querySelector(".os-more") &&
        card.querySelector(".os-more").setAttribute("aria-expanded", "false");
      card.querySelector(".os-drop") &&
        (card.querySelector(".os-drop").hidden = true);
    });
  }

  function initDrops() {
    document.querySelectorAll(".os-card").forEach(function (card) {
      var more = card.querySelector(".os-more");
      var drop = card.querySelector(".os-drop");
      if (!more || !drop) return;
      more.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = drop.hidden;
        closeDrops();
        if (open) {
          card.classList.add("open");
          more.setAttribute("aria-expanded", "true");
          drop.hidden = false;
        }
      });
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".os-card")) closeDrops();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrops();
    });
  }

  function render(release) {
    var version = versionFromTag(release && release.tag_name);
    var label = versionLabel(version);
    var assets = (release && release.assets) || [];

    document.getElementById("hero-badge").textContent = "الإصدار " + label;
    document.getElementById("footer-meta").textContent = "الإصدار " + label;
    document.getElementById("download-meta").textContent = "الإصدار " + label;

    ["windows", "mac", "linux"].forEach(function (os) {
      renderCard(os, assets);
    });

    var primary = document.getElementById("primary-download");
    var url = null;
    if (detectedOs && detectedArch) {
      var heroAsset = pickAsset(assets, detectedOs, detectedArch);
      if (heroAsset) {
        url = heroAsset.browser_download_url;
      } else if (FALLBACK_ASSETS[detectedOs]) {
        var fb =
          FALLBACK_ASSETS[detectedOs][detectedArch] || FALLBACK_ASSETS[detectedOs].x64;
        url = ASSET_DOWNLOAD_URL + encodeURIComponent(fb);
      }
    }
    if (!url) url = RELEASES_URL;
    setLink(primary, url);
  }

  function renderFallback() {
    render(null);
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeCache(entry) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch (e) {}
  }

  function loadRelease() {
    var cached = readCache();
    if (cached && cached.data && cached.ts && Date.now() - cached.ts < CACHE_TTL) {
      render(cached.data);
      return;
    }

    var headers = { Accept: "application/vnd.github+json" };
    if (cached && cached.etag) headers["If-None-Match"] = cached.etag;

    fetch(API_LATEST_URL, { headers: headers })
      .then(function (res) {
        if (res.status === 304) {
          if (cached && cached.data) {
            cached.ts = Date.now();
            writeCache(cached);
            render(cached.data);
          } else {
            renderFallback();
          }
          return null;
        }
        if (!res.ok) throw new Error("api " + res.status);
        return res.json().then(function (data) {
          return {
            ts: Date.now(),
            etag: res.headers.get("etag") || "",
            data: data,
          };
        });
      })
      .then(function (entry) {
        if (entry) {
          writeCache(entry);
          render(entry.data);
        }
      })
      .catch(function () {
        if (cached && cached.data) {
          render(cached.data);
        } else {
          renderFallback();
        }
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
  initDrops();
  loadRelease();
})();