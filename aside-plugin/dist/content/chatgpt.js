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
  const TURN_SEL = "article[data-turn]";
  const MSG_SEL = "[data-message-id]";
  const ROLE_ATTR = "data-message-author-role";
  class ChatGPTAdapter extends BaseAdapter {
    constructor() {
      super(...arguments);
      __publicField(this, "platform", "chatgpt");
    }
    detectPlatform() {
      return /^https:\/\/(chat\.openai\.com|chatgpt\.com)/.test(location.href);
    }
    extractConvId(url) {
      const match = url.match(/\/c\/([0-9a-f-]{36})/);
      return (match == null ? void 0 : match[1]) ?? null;
    }
    parseMessages() {
      const turns = document.querySelectorAll(TURN_SEL);
      console.log("[Aside:ChatGPT] Found turns:", turns.length);
      const results = [];
      turns.forEach((turn) => {
        const turnRole = turn.getAttribute("data-turn");
        const msgEl = turn.querySelector(MSG_SEL);
        const platformId = (msgEl == null ? void 0 : msgEl.getAttribute("data-message-id")) ?? turn.getAttribute("data-turn-id") ?? `chatgpt-turn-${results.length}`;
        const role = turnRole === "user" || turnRole === "assistant" ? turnRole : (msgEl == null ? void 0 : msgEl.getAttribute(ROLE_ATTR)) ?? "user";
        const content = this.extractContent(msgEl ?? turn, role);
        if (!content) return;
        results.push({ platformId, role, content });
      });
      console.log("[Aside:ChatGPT] Parsed messages order:", results.map((m) => m.role).join(", "));
      return results;
    }
    extractContent(el, role) {
      var _a;
      if (!el) return "";
      const prose = el.querySelector('.markdown, .prose, [class*="markdown"]');
      if (prose) {
        return this.htmlToMarkdown(prose);
      }
      return ((_a = el.textContent) == null ? void 0 : _a.trim()) ?? "";
    }
    htmlToMarkdown(el) {
      var _a;
      const clone = el.cloneNode(true);
      const codeBlocks = [];
      clone.querySelectorAll("pre").forEach((pre) => {
        const cmContent = pre.querySelector(".cm-content");
        if (cmContent) {
          const code2 = cmContent.textContent || "";
          const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
          codeBlocks.push(`
\`\`\`
${code2}
\`\`\`
`);
          pre.outerHTML = placeholder;
          return;
        }
        const code = pre.querySelector("code");
        if (code) {
          const langMatch = code.className.match(/language-(\w+)/);
          const lang = langMatch ? langMatch[1] : "";
          const content = code.textContent || "";
          const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
          codeBlocks.push(`
\`\`\`${lang}
${content}
\`\`\`
`);
          pre.outerHTML = placeholder;
        }
      });
      clone.querySelectorAll("table").forEach((table) => {
        const rows = [];
        table.querySelectorAll("tr").forEach((tr) => {
          const cells = [];
          tr.querySelectorAll("th, td").forEach((cell) => {
            var _a2;
            cells.push(((_a2 = cell.textContent) == null ? void 0 : _a2.trim()) || "");
          });
          rows.push("| " + cells.join(" | ") + " |");
        });
        if (rows.length > 0) {
          const colCount = rows[0].split("|").filter((c) => c.trim()).length;
          const separator = "| " + Array(colCount).fill("---").join(" | ") + " |";
          table.outerHTML = "\n\n" + rows[0] + "\n" + separator + "\n" + rows.slice(1).join("\n") + "\n\n";
        }
      });
      clone.querySelectorAll("code").forEach((code) => {
        if (!code.closest("pre")) {
          code.outerHTML = `\`${code.textContent}\``;
        }
      });
      clone.querySelectorAll("strong, b").forEach((b) => {
        b.outerHTML = `**${b.textContent}**`;
      });
      clone.querySelectorAll("em, i").forEach((i) => {
        i.outerHTML = `*${i.textContent}*`;
      });
      clone.querySelectorAll("h1").forEach((h) => {
        h.outerHTML = `
# ${h.textContent}
`;
      });
      clone.querySelectorAll("h2").forEach((h) => {
        h.outerHTML = `
## ${h.textContent}
`;
      });
      clone.querySelectorAll("h3").forEach((h) => {
        h.outerHTML = `
### ${h.textContent}
`;
      });
      clone.querySelectorAll("ul").forEach((ul) => {
        ul.querySelectorAll(":scope > li").forEach((li) => {
          var _a2;
          const text = ((_a2 = li.textContent) == null ? void 0 : _a2.trim()) || "";
          li.outerHTML = `
- ${text}`;
        });
      });
      clone.querySelectorAll("ol").forEach((ol) => {
        ol.querySelectorAll(":scope > li").forEach((li, idx) => {
          var _a2;
          const text = ((_a2 = li.textContent) == null ? void 0 : _a2.trim()) || "";
          li.outerHTML = `
${idx + 1}. ${text}`;
        });
      });
      clone.querySelectorAll("hr").forEach((hr) => {
        hr.outerHTML = "\n\n---\n\n";
      });
      clone.querySelectorAll("p").forEach((p) => {
        p.outerHTML = `

${p.textContent}

`;
      });
      clone.querySelectorAll("br").forEach((br) => {
        br.outerHTML = "\n";
      });
      let result = ((_a = clone.textContent) == null ? void 0 : _a.trim()) || "";
      codeBlocks.forEach((block, index) => {
        result = result.replace(`__CODE_BLOCK_${index}__`, block);
      });
      result = result.replace(/\n{3,}/g, "\n\n");
      return result;
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
  runAdapter(new ChatGPTAdapter());
})();
//# sourceMappingURL=chatgpt.js.map
