var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function() {
  "use strict";
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
  const USER_SEL = '[data-testid="user-message"]';
  const AI_SEL = "[data-is-streaming]";
  const CONTAINER_CLS = "flex-1 flex flex-col px-4";
  class ClaudeAdapter extends BaseAdapter {
    constructor() {
      super(...arguments);
      __publicField(this, "platform", "claude");
    }
    detectPlatform() {
      return location.hostname === "claude.ai";
    }
    extractConvId(url) {
      const match = url.match(/\/chat\/([0-9a-f-]{36})/);
      return (match == null ? void 0 : match[1]) ?? null;
    }
    parseMessages() {
      const container = this.findTurnContainer();
      if (!container) return this.fallbackParse();
      const results = [];
      Array.from(container.children).forEach((child, index) => {
        var _a;
        const userEl = child.querySelector(USER_SEL);
        const aiEl = child.querySelector(AI_SEL);
        if (userEl) {
          const content = ((_a = userEl.textContent) == null ? void 0 : _a.trim()) ?? "";
          if (!content) return;
          results.push({
            platformId: `claude-turn-${index}`,
            role: "user",
            content
          });
        } else if (aiEl) {
          const content = this.extractAIContent(aiEl);
          if (!content) return;
          results.push({
            platformId: `claude-turn-${index}`,
            role: "assistant",
            content
          });
        }
      });
      return results;
    }
    /** 找到包含所有 turn 的滚动容器 */
    findTurnContainer() {
      const anchor = document.querySelector(AI_SEL);
      if (!anchor) return null;
      let el = anchor;
      for (let i = 0; i < 6; i++) {
        el = (el == null ? void 0 : el.parentElement) ?? null;
        if (!el) break;
        if (el.className.includes(CONTAINER_CLS) && el.children.length > 2) {
          return el;
        }
      }
      return document.querySelector(`[class*="${CONTAINER_CLS}"]`);
    }
    /** 兜底：容器找不到时按选择器顺序交替解析 */
    fallbackParse() {
      var _a;
      const results = [];
      const userEls = document.querySelectorAll(USER_SEL);
      const aiEls = document.querySelectorAll(AI_SEL);
      const total = Math.max(userEls.length, aiEls.length);
      for (let i = 0; i < total; i++) {
        if (userEls[i]) {
          results.push({
            platformId: `claude-user-${i}`,
            role: "user",
            content: ((_a = userEls[i].textContent) == null ? void 0 : _a.trim()) ?? ""
          });
        }
        if (aiEls[i]) {
          results.push({
            platformId: `claude-ai-${i}`,
            role: "assistant",
            content: this.extractAIContent(aiEls[i])
          });
        }
      }
      return results.filter((m) => m.content);
    }
    extractAIContent(el) {
      var _a;
      const prose = el.querySelector('.prose, [class*="prose"]');
      return ((_a = (prose ?? el).textContent) == null ? void 0 : _a.trim()) ?? "";
    }
  }
  function debounce(fn, delayMs) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delayMs);
    };
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
  runAdapter(new ClaudeAdapter());
})();
//# sourceMappingURL=claude.js.map
