// Receives a captured frame from the content script and saves it to the
// Downloads folder without prompting.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "quicksnap-save") return;

  chrome.downloads.download(
    {
      url: msg.dataUrl,
      filename: msg.filename,
      saveAs: false,
      conflictAction: "uniquify",
    },
    (downloadId) => {
      if (chrome.runtime.lastError || downloadId === undefined) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message || "Download failed" });
      } else {
        sendResponse({ ok: true });
      }
    }
  );

  return true; // keep the channel open for the async response
});
