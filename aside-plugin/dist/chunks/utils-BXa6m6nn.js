var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
    if (!getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
  }
  return getRandomValues(rnds8);
}
var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
const native = {
  randomUUID
};
function v4(options, buf, offset) {
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }
  options = options || {};
  var rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
const APP_VERSION = "0.1.0";
const SCHEMA_VERSION = "aside/v1";
const FILE_VERSION = "1.0";
const newId = () => v4();
const now = () => Date.now();
function createEmptyFile() {
  return {
    $schema: SCHEMA_VERSION,
    meta: {
      fileVersion: FILE_VERSION,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastModified: (/* @__PURE__ */ new Date()).toISOString(),
      appVersion: APP_VERSION
    },
    trees: [],
    settings: {
      defaultView: "tree",
      storageBackend: "local-file"
    }
  };
}
function createRootNode(treeId) {
  const id = newId();
  return {
    id,
    treeId,
    parentId: null,
    childrenIds: [],
    label: "根对话",
    messages: [],
    isStarred: false,
    isPruned: false,
    xRef: [],
    mergeFrom: [],
    position: { x: 0, y: 0 },
    annotations: [],
    createdAt: now(),
    updatedAt: now()
  };
}
function getNode(tree, nodeId) {
  return tree.nodes.find((n) => n.id === nodeId);
}
function applyPatch(file, op) {
  const trees = file.trees.map((tree) => {
    var _a;
    if ("treeId" in op && op.treeId !== tree.id) return tree;
    switch (op.op) {
      case "addNode": {
        const nodes = tree.nodes.map(
          (n) => n.id === op.node.parentId ? { ...n, childrenIds: [...n.childrenIds, op.node.id], updatedAt: now() } : n
        );
        return { ...tree, nodes: [...nodes, op.node], updatedAt: now() };
      }
      case "updateNode":
        return {
          ...tree,
          nodes: tree.nodes.map(
            (n) => n.id === op.nodeId ? { ...n, ...op.changes, updatedAt: now() } : n
          ),
          updatedAt: now()
        };
      case "pruneNode":
        return {
          ...tree,
          nodes: tree.nodes.map(
            (n) => n.id === op.nodeId ? { ...n, isPruned: true, updatedAt: now() } : n
          ),
          updatedAt: now()
        };
      case "deleteNode": {
        const toDelete = collectSubtreeIds(tree, op.nodeId);
        const parentId = (_a = getNode(tree, op.nodeId)) == null ? void 0 : _a.parentId;
        return {
          ...tree,
          nodes: tree.nodes.filter((n) => !toDelete.has(n.id)).map(
            (n) => n.id === parentId ? { ...n, childrenIds: n.childrenIds.filter((id) => id !== op.nodeId), updatedAt: now() } : n
          ),
          updatedAt: now()
        };
      }
      case "starNode":
        return {
          ...tree,
          nodes: tree.nodes.map(
            (n) => n.id === op.nodeId ? { ...n, isStarred: op.value, updatedAt: now() } : n
          ),
          updatedAt: now()
        };
      case "addMessage":
        return {
          ...tree,
          nodes: tree.nodes.map(
            (n) => n.id === op.nodeId ? { ...n, messages: [...n.messages, op.message], updatedAt: now() } : n
          ),
          updatedAt: now()
        };
      case "addAnnotation":
        return {
          ...tree,
          nodes: tree.nodes.map(
            (n) => n.id === op.nodeId ? { ...n, annotations: [...n.annotations, op.annotation], updatedAt: now() } : n
          ),
          updatedAt: now()
        };
      case "updateTree":
        return { ...tree, ...op.changes, updatedAt: now() };
      default:
        return tree;
    }
  });
  if (op.op === "addTree") {
    return {
      ...file,
      trees: [...file.trees, op.tree],
      meta: { ...file.meta, lastModified: (/* @__PURE__ */ new Date()).toISOString() }
    };
  }
  return {
    ...file,
    trees,
    meta: { ...file.meta, lastModified: (/* @__PURE__ */ new Date()).toISOString() }
  };
}
function collectSubtreeIds(tree, rootId) {
  const ids = /* @__PURE__ */ new Set();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    ids.add(id);
    const node = getNode(tree, id);
    node == null ? void 0 : node.childrenIds.forEach((cid) => queue.push(cid));
  }
  return ids;
}
function isSameConversation(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch {
    return false;
  }
}
export {
  applyPatch as a,
  newId as b,
  createEmptyFile as c,
  createRootNode as d,
  isSameConversation as i,
  now as n
};
//# sourceMappingURL=utils-BXa6m6nn.js.map
