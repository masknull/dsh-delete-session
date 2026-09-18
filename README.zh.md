# dsh-delete-session

> 在 DeepSeek Harness Web 侧栏的会话行 `⋯` 菜单里，增加一项「删除会话」——永久删除该会话。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
**中文** · [English](README.md)

本插件在侧栏会话行菜单（*重命名* / *分叉会话* / *归档会话* 之后）追加一个 **删除会话** 动作，把该会话的转录从磁盘上永久删除。

实现上**不禁用、不替换任何官方插件行**，也**不接管任何宿主服务**——因此不会出现"服务无人发布 → 整棵插件树 pending → 启动崩溃"这类故障。

---

## 功能

| | |
|---|---|
| **永久删除** | 删除该会话独占的 JSONL 转录目录。没有回收站，不可恢复。 |
| **强制二次确认** | 弹出写明会话标题的确认框；请求还带一个非简单自定义头，普通 HTML 表单或链接无法伪造。 |
| **运行中的会话先停掉** | 先通过宿主句柄拆掉活跃 Agent，等持久化 drain 完成、确认会话已摘载，才碰文件。 |
| **记账同步清理** | 从所属工作区摘除、从归档集合摘除、并通知前端移除该行——无需手动刷新。 |
| **零接管** | bundle 只 insert 自己一行。不禁用任何行、不替换任何行、不发布任何服务。 |
| **跟随主题** | 确认弹窗全部使用 DSH 自己的主题变量，自动适配浅色/深色。 |
| **双语** | 菜单项与弹窗跟随宿主语言（中文 / English）；宿主 locale 服务缺失时回退到内置对照表。 |

---

## 环境要求

- 使用 **Web** profile 的 DeepSeek Harness（`dsh web`）。
- 逐会话 JSONL 持久化后端（`session-persistence-jsonl`，即默认后端）。
- 已在 DSH `0.1.5-rc.2` 实测。删除路由采用**失败即降级**策略：前置条件缺失时只是不注册路由、UI 上报请求失败，**插件激活期间永不抛错**。

---

## 安装

```powershell
# 从 git 仓库安装
dsh plugin --profile web add github:masknull/dsh-delete-session

# 或从本地目录安装
dsh plugin --profile web add link:/path/to/dsh-delete-session
```

安装后重启 `dsh web`，让插件树重新合成。

## 卸载

```powershell
dsh plugin --profile web remove dsh-delete-session
```

---

## 为什么写这个插件

需要的只是「删除会话」这一个功能。同类插件通常会把归档、恢复、搜索等一整套会话管理一起带进来，而使用中还遇到过 `dsh web` 偶发性的启动失败——排查了一个下午才定位到原因。既然只需要删除，就单独写了这个插件，只做这一件事。

## 工作原理

DSH 目前**没有公开的会话删除 API**：`ctx.workspaceRegistry` 只有 `archiveSession`（软删除，仅打标记）和 `deleteKnown`（删的是**工作区**不是会话）；`api-session-controller` 的 remote 面有 create / rename / fork / list / search，**没有 delete**。而且会话行的 `⋯` 菜单**不是扩展点**——菜单项硬编码在官方 `ui-workspace` 的 `SessionNodeItem` 组件里，会话行内部没有任何 slot。

因此本插件不去 fork 官方 UI，而是走两条**在真实运行界面上验证过**的 DOM 缝：

1. **打开中的菜单 → React fiber 归属**：会话行菜单、视图选项（分组方式/排序）菜单、工作区行菜单都是同一个 `Menu` portal 组件，共享 `document.body` 下同一个 `[role="menu"]` DOM——单看 DOM 结构无法区分归属。但打开的菜单元素沿 React fiber 链仍能回到宿主组件：只有宿主为 `SessionNodeItem`（`memoizedProps` 携带 `node.id` + `onRename`，该形状在整个 client 树中唯一）的菜单才会被注入。sessionId 与标题在注入时从这些 props 解析，不存在"最后点击行"缓存，也就不会过期错删。
2. **菜单项本身**：**类名在运行时从当前渲染中的官方项复制**，所以即使构建哈希变化也能继承真实样式；图标用的是从本机前端产物里取出的官方 `IconTrashOutline16` 几何，与原生三个图标同族。

两条缝任一消失（官方将来改版），表现是**菜单里不再出现该项**——绝不会退化成"猜一个 sessionId 去删"。

### Host 侧

只有一条路由：`POST /plugins/dsh-delete-session/delete`。

删除实现移植自 [`dsh-chat-manager`](https://github.com/WSL043/dsh-chat-manager)（MIT，见文末许可），它有几处严谨设计值得保留：

- 目标路径必须是会话根下**恰好三段**，且转录文件名匹配 JSONL 代际规则；
- 会话目录先**原子改名进隔离区**，再用 `dev`/`ino`/`mode`/`size`/`birthtimeNs` 复核身份，之后才递归删除（防 TOCTOU 与符号链接替换）；
- 活跃 Agent 通过从 `agents.create` / `resume` / `enter` 捕获的 handle 释放，删除期间用 reservation 拒绝同 id 重开；
- 请求边界强制：仅 POST、同源、确认头、JSON 类型、8KB 体积上限、sessionId 形状校验。

**在移植之上新增的部分**：物理删除完成后，用**公开 API** 对账——
`workspaceRegistry.list()` 找到持有该会话的实体 → `entity.detachSession(id)`（公开、幂等、不碰会话日志），
再从 `archivedSessionIds` 摘除该 id，最后广播 `api-session/removed`，让官方客户端移除该行。

### 不删除什么

**投影缓存行**（`session_projcache`）有意保留。会话列表的数据源是磁盘扫描 + host/client 双重 join 过滤，孤儿缓存行不会渲染成可见条目。要清它就必须替换官方 `session-projection-cache` 服务——而那正是本插件刻意回避的接管方式。

---

## 主题与颜色

确认弹窗的颜色**全部取自 DSH 自己的主题变量**。这些变量声明在 `<body>` 上，并在 `body[data-ds-dark-theme]` 下重新声明，因此一份声明同时适配深浅主题：

| 用途 | 变量 |
|---|---|
| 弹窗背景 | `--dsw-specific-menu` → `--dsw-alias-bg-layer-3` |
| 主文字 | `--dsw-alias-label-primary` |
| 边框 | `--dsw-alias-border-l2` |
| 危险色 | `--dsw-alias-state-error-primary` |
| 遮罩 | `--dsw-alias-bg-mask-1` |
| 阴影（含 0.5px 描边） | `--dsw-elevation-panel` |
| 字体 | `--dsw-font-family` |

两个踩过的坑：

- **不要凭直觉编造变量名。** 初版用了 `--dsw-alias-bg-elevated` 这类看起来很像的名字——它们**根本不存在**，于是背景 fallback 到硬编码深灰，而文字变量恰好存在并取到主题深色值，**浅色主题下就成了深底深字**。
- **变量定义在 `<body>` 而不是 `:root`。** 直接读 `document.documentElement` 会全部拿到空值；要用挂在 `body` 下的元素去读。

```js
const probe = document.createElement('div'); document.body.appendChild(probe);
getComputedStyle(probe).getPropertyValue('--dsw-specific-menu');   // 空串 = 不存在
probe.remove();
```

---

## 失效表现与排查

本插件依赖上面两条 DOM 缝。官方若改动它们，表现是**菜单里不再出现「删除会话」**——不会误删任何数据。

排查顺序：

1. 打开的菜单是否仍是 `[role="menu"]`，其 fiber 链上是否还有带 `node.id` + `onRename` 的 props（即它是否仍是会话行的菜单）；
2. 菜单项是否仍是 `[role="menuitem"]`；
3. React 是否仍把 fiber 挂在 DOM 节点上（`__reactFiber$` / `__reactInternalInstance$` 前缀）。

---

## 许可

MIT。`src/host/` 下的删除实现移植自
[dsh-chat-manager](https://github.com/WSL043/dsh-chat-manager)（MIT），各文件头部保留了出处与改动说明。

## 致谢

感谢 [dsh-chat-manager](https://github.com/WSL043/dsh-chat-manager)（作者 WSL043）：
本插件的核心建立在它的 Host 侧删除实现之上。那些真正困难的部分——捕获 Agent 句柄、
带身份复核的隔离区改名、请求边界校验——它都已经解决得很好，这也正是本插件能做得这么小的原因。

同样感谢 DeepSeek Harness 官方团队：本插件使用的主题变量、locale 服务与
`IconTrashOutline16` 图标几何，都来自官方前端。
