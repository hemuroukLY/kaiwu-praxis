/* client-src/40-plaza.js — 数字员工广场 PlazaOverlay */
    // ---------------------------------------------------------------------
    // 广场组件（挂到 shell.overlay，由侧边栏入口驱动开合，只覆盖主内容区）。
    // ---------------------------------------------------------------------
    function PlazaOverlay(props) {
      var api = props.api;
      var sessions = props.sessions;
      var startSession = props.startSession;
      var createWorkspace = props.createWorkspace;
      var renameWorkspace = props.renameWorkspace;
      var openWorkerSession = props.openWorkerSession;
      var t = props.t;

      var _o = React.useState([]);
      var options = _o[0];
      var setOptions = _o[1];
      var _b = React.useState(false);
      var busy = _b[0];
      var setBusy = _b[1];
      var _e = React.useState(null);
      var error = _e[0];
      var setError = _e[1];
      var _v = React.useState(false);
      var visible = _v[0];
      var setVisible = _v[1];
      var _l = React.useState(280);
      var leftPx = _l[0];
      var setLeftPx = _l[1];
      var _w = React.useState("plaza");
      var view = _w[0];
      var setView = _w[1];
      var _r = React.useState(null);
      var settingsRight = _r[0];
      var setSettingsRight = _r[1];

      var admin = useAdminData(api);

      // 用量与反馈由 Host（admin.mjs）采集并写入 settings，再经终端令牌心跳上报；
      // 浏览器只读 enterprise.feedbackByWorker / sessionCount，不再反向写 settings。

      var stagedRef = React.useRef(undefined);
      var pickedForRef = React.useRef(null);
      var busyRef = React.useRef(false);
      var pickGenRef = React.useRef(0);

      function setBusyState(next) {
        busyRef.current = !!next;
        setBusy(!!next);
      }

      React.useEffect(function () {
        var alive = true;
        if (!api || !api.agentPresets) {
          if (alive) setError("connection unavailable");
          return;
        }
        rosterCache.load(api).then(function (mine) {
          if (alive) setOptions(mine);
        }).catch(function (e) {
          if (alive) setError(messageOf(e));
        });
        return function () { alive = false; };
      }, [api]);

      React.useEffect(function () {
        setVisible(plazaStore.open);
        return plazaStore.subscribe(function (open) { setVisible(open); });
      }, []);

      // 打开广场时作废进行中的选人并清 busy，避免上次挂起后卡片点不动。
      React.useEffect(function () {
        if (!visible) return;
        pickGenRef.current += 1;
        setBusyState(false);
        setError(null);
      }, [visible]);

      React.useEffect(function () {
        function measure() {
          var col = document.querySelector("[class*='sidebarCol']");
          if (!col) col = document.querySelector("[data-pane='sidebar']");
          if (!col) return;
          var w = col.getBoundingClientRect().width;
          if (w > 0) setLeftPx(w);
        }
        measure();
        var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        var col = document.querySelector("[class*='sidebarCol']");
        if (ro && col) ro.observe(col);
        var mo = new MutationObserver(measure);
        var frame = document.querySelector("[data-dsh-frame]");
        if (frame) mo.observe(frame, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
        return function () { if (ro) ro.disconnect(); mo.disconnect(); };
      }, []);

      // dsh-better-sidebar 把两个面板按钮固定在右上角。广场打开时按它的
      // 实际边界放置「员工设置」，避免不同窗口宽度下文字与图标重叠；
      // 没安装该插件时保持顶部栏原有的流式位置。
      React.useEffect(function () {
        if (!visible) {
          setSettingsRight(null);
          return;
        }
        var cluster = null;
        var ro = null;
        function measureSettingsAnchor() {
          var next = document.querySelector("[data-dsh-toggle-cluster]");
          if (next !== cluster) {
            if (ro) ro.disconnect();
            cluster = next;
            ro = typeof ResizeObserver !== "undefined" && cluster ? new ResizeObserver(measureSettingsAnchor) : null;
            if (ro) ro.observe(cluster);
          }
          if (!cluster) {
            setSettingsRight(null);
            return;
          }
          var rect = cluster.getBoundingClientRect();
          setSettingsRight(Math.max(10, Math.round(window.innerWidth - rect.left + 8)));
        }
        measureSettingsAnchor();
        var mo = new MutationObserver(measureSettingsAnchor);
        mo.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("resize", measureSettingsAnchor);
        return function () {
          if (ro) ro.disconnect();
          mo.disconnect();
          window.removeEventListener("resize", measureSettingsAnchor);
        };
      }, [visible]);

      function applyStaged() {
        // 工作区选人进行中时禁止抢绑到「当前」空白会话。
        if (busyRef.current) return;
        var staged = stagedRef.current;
        if (staged === undefined || !sessions || !sessions.list) return;
        var state = sessions.list.getSnapshot();
        var cur = state.current;
        var summary = cur === undefined ? undefined : state.byId[cur];
        if (summary === undefined || !summary.blank) return;
        if (sessionAgentPreset(summary) === staged) {
          stagedRef.current = undefined;
          pickedForRef.current = summary.id;
          setPlazaOpen(false);
          return;
        }
        setBusyState(true);
        setError(null);
        api.agentPresets.select({ sessionId: summary.id, agentPreset: staged }).then(function (resp) {
          stagedRef.current = undefined;
          setBusyState(false);
          if (!resp.result.ok) {
            setError(resp.result.error.message);
            return;
          }
          pickedForRef.current = summary.id;
          setPlazaOpen(false);
        }).catch(function (e) {
          stagedRef.current = undefined;
          setBusyState(false);
          setError(messageOf(e));
        });
      }

      React.useEffect(function () {
        if (!sessions || !sessions.list) return;
        function refresh() { applyStaged(); }
        refresh();
        return sessions.list.subscribe(refresh);
      }, [sessions, api]);

      function pick(id) {
        // 进行中禁止连点；卡片 disabled=busy，此处再挡一层。
        if (busyRef.current) return;
        setError(null);
        // 不经 staged/applyStaged：由 startWorkerWorkspace → openWorkerSession 绑定，
        // 避免异步建区期间把员工选进错误会话。
        stagedRef.current = undefined;
        startWorkerWorkspace(id);
      }

      function workerTitle(id) {
        var fromRoster = rosterCache.byId[id];
        if (fromRoster && (fromRoster.name || fromRoster.id)) return fromRoster.name || fromRoster.id;
        for (var i = 0; i < options.length; i++) {
          if (options[i].id === id) return options[i].name || options[i].id;
        }
        return id;
      }

      function joinWorkspacePath(base, child) {
        var sep = String(base).indexOf("\\") >= 0 ? "\\" : "/";
        return String(base).replace(/[\\/]+$/, "") + sep + child;
      }

      function renameWorkspaceAs(workspaceId, title) {
        if (typeof renameWorkspace !== "function") return Promise.resolve();
        function attempt(n) {
          var next = n <= 1 ? title : title + " (" + n + ")";
          return renameWorkspace(workspaceId, next).catch(function (err) {
            if (n >= 30) throw err;
            return attempt(n + 1);
          });
        }
        return attempt(1);
      }

      // 宿主已为每位员工建好「临时对话/<workerId>」目录；采用为工作区并命名后，
      // 必须在该工作区内开会话再选中员工，避免对话落在别的工作区。
      function startWorkerWorkspace(id) {
        if (!createWorkspace || typeof openWorkerSession !== "function") {
          setError("workspaces unavailable");
          return;
        }
        var title = workerTitle(id);
        var gen = ++pickGenRef.current;
        setBusyState(true);
        setError(null);
        admin.load(api).then(function (a) {
          if (gen !== pickGenRef.current) return null;
          var tempPath = a.tempWorkspacePath;
          if (!tempPath) throw new Error("tempWorkspacePath missing");
          return createWorkspace(joinWorkspacePath(tempPath, id));
        }).then(function (ws) {
          if (gen !== pickGenRef.current || ws == null) return null;
          var workspaceId = ws && (ws.workspaceId || (ws.workspace && ws.workspace.workspaceId));
          if (!workspaceId) throw new Error("workspaceId missing");
          return renameWorkspaceAs(workspaceId, title).then(function () {
            return workspaceId;
          }, function () {
            return workspaceId;
          });
        }).then(function (workspaceId) {
          if (gen !== pickGenRef.current || workspaceId == null) return null;
          stagedRef.current = undefined;
          return openWorkerSession(workspaceId, id);
        }).then(function () {
          if (gen !== pickGenRef.current) return;
          setBusyState(false);
          pickedForRef.current = id;
          setPlazaOpen(false);
        }).catch(function (e) {
          if (gen !== pickGenRef.current) return;
          setBusyState(false);
          stagedRef.current = undefined;
          setError(messageOf(e));
        });
      }

      if (!visible) return null;

      if (options.length === 0) {
        return React.createElement("div", { className: "kwp-fixed", style: { left: leftPx + "px" } },
          React.createElement("div", { className: error ? "kwp-error" : "kwp-loading", role: error ? "alert" : undefined },
            error ? t("error") + " · " + error : t("loading")
          )
        );
      }

      var list = options;

      function workerCounts(id, meta) {
        var w = admin && admin.workers ? admin.workers[id] : undefined;
        if (!w) return { zi: meta.zi, skill: meta.skill, sop: meta.sop };
        return {
          zi: (w.knowledge || []).length,
          skill: (w.skills || []).filter(function (item) { return item.enabled !== false && item.deleted !== true; }).length,
          sop: (w.sops || []).length
        };
      }

      return React.createElement("div", { className: "kwp-fixed", style: { left: leftPx + "px" } },
        React.createElement("div", { className: "kwp-topbar" },
          React.createElement("button", {
            type: "button",
            className: "kwp-back",
            onClick: function () {
              if (view === "admin") setView("plaza");
              else setPlazaOpen(false);
            }
          },
            React.createElement("span", { className: "kwp-backChevron" }, "‹"),
            view === "admin" ? t("backToPlaza") : t("back")
          ),
          React.createElement("span", { className: "kwp-title" }, view === "admin" ? t("admin") : t("navPlaza")),
          view === "plaza"
            ? React.createElement("div", {
                className: "kwp-topRight",
                "data-anchored": settingsRight !== null,
                style: settingsRight === null ? undefined : { right: settingsRight + "px" }
              },
                React.createElement("button", { type: "button", className: "kwp-ghostBtn", onClick: function () { setView("admin"); } }, t("admin"))
              )
            : null
        ),
        view === "admin"
          ? React.createElement(AdminPanel, { api: api, t: t, admin: admin, sessions: sessions })
          : React.createElement("div", { className: "kwp-content" },
              list.length === 0
                ? React.createElement("div", { className: "kwp-emptyHint" }, t("noResult"))
                : React.createElement("div", { className: "kwp-grid" },
                    list.map(function (p) {
                      var meta = WORKER_META[p.id] || { role: "", icon: (p.name || p.id).charAt(0), gradient: "linear-gradient(135deg,#0f766e,#14b8a6)", zi: 0, skill: 0, sop: 0, tags: [] };
                      var counts = workerCounts(p.id, meta);
                      var tags = meta.tags || [];
                      return React.createElement("button", {
                        key: p.id,
                        type: "button",
                        className: "kwp-card",
                        "aria-label": t("ariaCard") + (p.name || p.id),
                        disabled: busy,
                        onClick: function () { pick(p.id); },
                        children: [
                          React.createElement("span", { className: "kwp-cardBand" },
                            React.createElement("span", { className: "kwp-avatarBox" },
                              React.createElement("span", { className: "kwp-avatarInner", style: { background: meta.av ? "transparent" : meta.gradient } }, kwAvatar(meta))
                            ),
                            React.createElement("span", { className: "kwp-id" },
                              React.createElement("strong", { className: "kwp-name" },
                                (p.name || p.id) + " ",
                                React.createElement("span", { className: "kwp-handle" }, "@admin")
                              ),
                              React.createElement("span", { className: "kwp-role" }, meta.role),
                              React.createElement("span", { className: "kwp-online" },
                                React.createElement("i", null),
                                t("online")
                              )
                            ),
                            React.createElement("span", { className: "kwp-chatBtn" }, chatIcon())
                          ),
                          React.createElement("p", { className: "kwp-desc" }, p.description || ""),
                          tags.length > 0
                            ? React.createElement("div", { className: "kwp-tags" },
                                tags.slice(0, 3).map(function (tag) {
                                  return React.createElement("span", { key: tag, className: "kwp-wtag" }, tag);
                                })
                              )
                            : null,
                          React.createElement("div", { className: "kwp-stats" },
                            React.createElement("div", { className: "kwp-statCell" },
                              React.createElement("strong", { className: "kwp-statValue" }, String(counts.zi)),
                              React.createElement("em", { className: "kwp-statLabel" }, t("zi"))
                            ),
                            React.createElement("div", { className: "kwp-statCell" },
                              React.createElement("strong", { className: "kwp-statValue" }, String(counts.skill)),
                              React.createElement("em", { className: "kwp-statLabel" }, t("skill"))
                            ),
                            React.createElement("div", { className: "kwp-statCell" },
                              React.createElement("strong", { className: "kwp-statValue" }, String(counts.sop)),
                              React.createElement("em", { className: "kwp-statLabel" }, t("sop"))
                            )
                          )
                        ]
                      });
                    })
                  ),
              React.createElement("div", { className: "kwp-hint" }, t("hint"))
            )
      );
    }

