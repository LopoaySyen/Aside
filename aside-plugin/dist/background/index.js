import { i as isSameConversation } from "../chunks/utils-BXa6m6nn.js";
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  console.log("[Aside] Extension installed.");
});
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "aside-root",
      title: "Aside",
      contexts: ["all"]
    });
    const items = [
      { id: "navigate", title: "🔗 在网页中定位" },
      { id: "create-child", title: "✨ 创建子分支" },
      { id: "star", title: "★ 标注 / 取消标注" },
      { id: "set-color", title: "🎨 设置颜色" },
      { id: "prune", title: "✂️ 减枝（隐藏）" },
      { id: "xref", title: "↔️ 引用到其他节点" },
      { id: "delete", title: "🗑 永久删除" }
    ];
    items.forEach((item) => {
      chrome.contextMenus.create({
        id: item.id,
        parentId: "aside-root",
        title: item.title,
        contexts: ["all"]
      });
    });
  });
}
chrome.contextMenus.onClicked.addListener((info) => {
  chrome.storage.session.get("focusedNodeId", ({ focusedNodeId }) => {
    if (!focusedNodeId) return;
    const action = info.menuItemId;
    if (action === "navigate") {
      chrome.storage.session.get("focusedNodeData", ({ focusedNodeData }) => {
        if (focusedNodeData) navigateToNode(focusedNodeData);
      });
    } else {
      broadcastToSidePanel({
        type: "CONTEXT_MENU_ACTION",
        payload: { action, nodeId: focusedNodeId }
      });
    }
  });
});
async function navigateToNode(data) {
  const { originalUrl, anchorPlatformId } = data;
  const allTabs = await chrome.tabs.query({});
  const match = allTabs.find((tab) => tab.url && isSameConversation(tab.url, originalUrl));
  let tabId;
  if (match == null ? void 0 : match.id) {
    if (match.windowId) {
      await chrome.windows.update(match.windowId, { focused: true });
    }
    await chrome.tabs.update(match.id, { active: true });
    tabId = match.id;
  } else {
    const tab = await chrome.tabs.create({ url: originalUrl, active: true });
    if (!tab.id) return;
    tabId = tab.id;
    await waitForTabLoad(tabId);
  }
  if (anchorPlatformId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "SCROLL_TO_MESSAGE",
        payload: { anchorPlatformId, highlight: true }
      });
    } catch {
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: "SCROLL_TO_MESSAGE",
            payload: { anchorPlatformId, highlight: true }
          });
        } catch (e) {
          console.warn("[Aside] Could not send SCROLL_TO_MESSAGE:", e);
        }
      }, 1500);
    }
  }
}
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 1e4);
  });
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  var _a, _b;
  console.log("[Aside:Background] Received message:", msg.type, "from:", (_a = sender.tab) == null ? void 0 : _a.url);
  switch (msg.type) {
    case "MESSAGES_CAPTURED":
      console.log("[Aside:Background] Forwarding MESSAGES_CAPTURED to sidepanel");
      broadcastToSidePanel(msg);
      sendResponse({ ok: true });
      break;
    case "OPEN_SIDEPANEL":
      if ((_b = sender.tab) == null ? void 0 : _b.windowId) {
        chrome.sidePanel.open({ windowId: sender.tab.windowId });
      }
      sendResponse({ ok: true });
      break;
    default:
      broadcastToSidePanel(msg);
  }
  return true;
});
async function broadcastToSidePanel(msg) {
  try {
    await chrome.storage.session.set({
      ["aside_msg_" + Date.now()]: JSON.stringify(msg)
    });
    console.log("[Aside:Background] Message stored for sidepanel:", msg.type);
  } catch (err) {
    console.error("[Aside:Background] Failed to store message:", err);
  }
  try {
    await chrome.runtime.sendMessage(msg);
    console.log("[Aside:Background] Message sent to sidepanel directly");
  } catch (err) {
    console.log("[Aside:Background] Sidepanel not open, message stored in storage");
  }
}
//# sourceMappingURL=index.js.map
