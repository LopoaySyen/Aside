import { d as debounce } from "./utils-igF3sxR5.js";
class BaseAdapter {
  /** Default: MutationObserver on document.body watching for new message nodes */
  observeChanges(callback) {
    let knownIds = new Set(this.parseMessages().map((m) => m.platformId));
    const observer = new MutationObserver(() => {
      const current = this.parseMessages();
      for (const msg of current) {
        if (!knownIds.has(msg.platformId)) {
          knownIds.add(msg.platformId);
          callback(msg);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    return () => observer.disconnect();
  }
  cleanText(el) {
    var _a;
    return ((_a = el == null ? void 0 : el.textContent) == null ? void 0 : _a.trim()) ?? "";
  }
  guessRole(el) {
    const cls = el.className + " " + (el.getAttribute("data-author") ?? "");
    if (/user|human/i.test(cls)) return "user";
    if (/assistant|ai|gpt|claude|model/i.test(cls)) return "assistant";
    return "user";
  }
}
function runAdapter(adapter) {
  console.log("[Aside:Content] runAdapter called, platform:", adapter.platform);
  if (!adapter.detectPlatform()) {
    console.log("[Aside:Content] Platform not detected, skipping");
    return;
  }
  console.log(`[Aside:Content] Detected platform: ${adapter.platform}`);
  const convId = adapter.extractConvId(location.href);
  setTimeout(async () => {
    const messages = await parseMessagesWithFallback(adapter);
    console.log(`[Aside:Content] Initial capture: ${messages.length} messages`);
    sendCapture(adapter, convId, messages);
  }, 1e3);
  const recaptureInterval = setInterval(async () => {
    const messages = await parseMessagesWithFallback(adapter);
    if (messages.length > 0) {
      console.log(`[Aside:Content] Periodic re-capture: ${messages.length} messages`);
      sendCapture(adapter, convId, messages);
    }
  }, 5e3);
  const onNewMessage = debounce((msg) => {
    sendCapture(adapter, convId, [msg]);
  }, 400);
  const cleanupObserver = adapter.observeChanges(onNewMessage);
  const messageListener = (msg) => {
    if (msg.type !== "SCROLL_TO_MESSAGE") return;
    const { anchorPlatformId, highlight } = msg.payload;
    scrollToMessage(anchorPlatformId, highlight ?? false);
  };
  chrome.runtime.onMessage.addListener(messageListener);
  window.addEventListener("beforeunload", () => {
    clearInterval(recaptureInterval);
    cleanupObserver();
    chrome.runtime.onMessage.removeListener(messageListener);
  }, { once: true });
}
async function parseMessagesWithFallback(adapter) {
  if ("parseMessagesAsync" in adapter && typeof adapter.parseMessagesAsync === "function") {
    return await adapter.parseMessagesAsync();
  }
  return adapter.parseMessages();
}
function sendCapture(adapter, convId, messages) {
  if (!messages.length) return;
  console.log("[Aside:Content] Sending MESSAGES_CAPTURED:", {
    convId: convId ?? location.href,
    platform: adapter.platform,
    messageCount: messages.length,
    messages: messages.slice(0, 2)
    // 只打印前2条避免日志过长
  });
  chrome.runtime.sendMessage({
    type: "MESSAGES_CAPTURED",
    payload: {
      convId: convId ?? location.href,
      platform: adapter.platform,
      messages
    }
  }).then(() => {
    console.log("[Aside:Content] MESSAGES_CAPTURED sent successfully");
  }).catch((err) => {
    console.warn("[Aside:Content] Failed to send MESSAGES_CAPTURED:", err);
  });
}
function scrollToMessage(platformId, highlight) {
  let el = null;
  if (platformId.startsWith("claude-turn-")) {
    const index = parseInt(platformId.replace("claude-turn-", ""), 10);
    const container = document.querySelector('[class*="flex-1 flex flex-col px-4"]');
    el = (container == null ? void 0 : container.children[index]) ?? null;
  } else if (platformId.startsWith("claude-user-") || platformId.startsWith("claude-ai-")) {
    const iUser = platformId.startsWith("claude-user-");
    const index = parseInt(platformId.split("-").pop() ?? "0", 10);
    const sel = iUser ? '[data-testid="user-message"]' : "[data-is-streaming]";
    el = document.querySelectorAll(sel)[index] ?? null;
  } else {
    el = document.querySelector(`[data-message-id="${CSS.escape(platformId)}"]`) ?? document.querySelector(`[data-turn-id="${CSS.escape(platformId)}"]`);
  }
  if (!el) {
    console.warn("[Aside] Could not find element for platformId:", platformId);
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (highlight) flashHighlight(el);
}
function flashHighlight(el) {
  const original = el.style.transition;
  el.style.transition = "outline 0s, box-shadow 0.15s";
  el.style.outline = "2px solid #b84c1a";
  el.style.boxShadow = "0 0 0 4px rgba(184,76,26,0.15)";
  setTimeout(() => {
    el.style.outline = "";
    el.style.boxShadow = "";
    el.style.transition = original;
  }, 1800);
}
export {
  BaseAdapter as B,
  runAdapter as r
};
//# sourceMappingURL=runner-4Qwhl92k.js.map
