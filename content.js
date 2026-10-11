(() => {
  const BUTTON_CLASS = "quicksnap-btn";

  const CAMERA_SVG = `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M9 3 7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>`;

  function formatTime(seconds) {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}h${pad(m)}m${pad(sec)}s` : `${pad(m)}m${pad(sec)}s`;
  }

  function getVideoTitle() {
    const h1 = document.querySelector("h1.ytd-watch-metadata, #title h1");
    const title = h1?.textContent?.trim() || document.title.replace(/\s*-\s*YouTube\s*$/, "");
    return title || "YouTube";
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[\\/:*?"<>|~\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .slice(0, 150) || "YouTube";
  }

  function showToast(player, text, isError = false) {
    let toast = player.querySelector(".quicksnap-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "quicksnap-toast";
      player.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.toggle("quicksnap-toast--error", isError);
    toast.classList.add("quicksnap-toast--visible");
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove("quicksnap-toast--visible"), 2200);
  }

  function flash(player) {
    const el = document.createElement("div");
    el.className = "quicksnap-flash";
    player.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  async function captureFrame(player) {
    const video = player.querySelector("video");
    if (!video || !video.videoWidth || !video.videoHeight) {
      showToast(player, "No video frame available yet", true);
      return;
    }

    // Draw at the video's native decoded resolution, not its on-screen size.
    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, 0, 0, width, height);

    let dataUrl;
    try {
      dataUrl = canvas.toDataURL("image/png"); // lossless
    } catch (e) {
      showToast(player, "This video can't be captured (protected content)", true);
      return;
    }

    const filename = `${sanitizeFilename(getVideoTitle())} - ${formatTime(video.currentTime)}.png`;

    flash(player);
    try {
      const res = await chrome.runtime.sendMessage({ type: "quicksnap-save", dataUrl, filename });
      if (res?.ok) {
        showToast(player, `Saved ${width}×${height} PNG`);
      } else {
        showToast(player, `Save failed: ${res?.error || "unknown error"}`, true);
      }
    } catch (e) {
      showToast(player, "Save failed — try reloading the page", true);
    }
  }

  function createButton(player) {
    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.type = "button";
    btn.title = "Save current frame (PNG, full resolution)";
    btn.setAttribute("aria-label", "Save current frame");
    btn.innerHTML = `${CAMERA_SVG}<span class="quicksnap-label">Snap</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      captureFrame(player);
    });
    const wrap = document.createElement("div");
    wrap.className = "quicksnap-wrap";
    wrap.appendChild(btn);
    return wrap;
  }

  function injectButtons() {
    document.querySelectorAll(".html5-video-player").forEach((player) => {
      const controls = player.querySelector(".ytp-right-controls");
      if (!controls || controls.querySelector(`.${BUTTON_CLASS}`)) return;
      controls.prepend(createButton(player));
    });
  }

  // YouTube is a single-page app: re-check on navigation and DOM changes.
  injectButtons();
  document.addEventListener("yt-navigate-finish", injectButtons);
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      injectButtons();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
