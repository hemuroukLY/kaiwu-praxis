/* client-src/40-plaza.js — 数字员工广场 PlazaOverlay */
    // ---------------------------------------------------------------------
    // 广场组件（挂到 shell.overlay，由侧边栏入口驱动开合，只覆盖主内容区）。
    // ---------------------------------------------------------------------
    function PlazaOverlay(props) {
      var api = props.api;
      var sessions = props.sessions;
      var startSession = props.startSession;
      var createWorkspace = props.createWorkspace;
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
        var staged = stagedRef.current;
        if (staged === undefined || !sessions || !sessions.list) return;
        var state = sessions.list.getSnapshot();
        var cur = state.current;
        var summary = cur === undefined ? undefined : state.byId[cur];
        if (summary === undefined || !summary.blank) return;
        if (summary.agentPreset === staged) {
          stagedRef.current = undefined;
          pickedForRef.current = summary.id;
          setPlazaOpen(false);
          return;
        }
        setBusy(true);
        setError(null);
        api.agentPresets.select({ sessionId: summary.id, agentPreset: staged }).then(function (resp) {
          stagedRef.current = undefined;
          setBusy(false);
          if (!resp.result.ok) {
            setError(resp.result.error.message);
            return;
          }
          pickedForRef.current = summary.id;
          setPlazaOpen(false);
        }).catch(function (e) {
          stagedRef.current = undefined;
          setBusy(false);
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
        if (busy) return;
        stagedRef.current = id;
        setError(null);
        var state = sessions && sessions.list ? sessions.list.getSnapshot() : undefined;
        var cur = state ? state.current : undefined;
        var summary = cur === undefined ? undefined : state.byId[cur];
        if (summary !== undefined && summary.blank) {
          applyStaged();
        } else if (startSession) {
          startWithoutWorkspace(id);
        }
      }

      // 无工作区时的兜底：DSH 的会话/输入框围绕工作区设计，未分组会话虽然能
      // 创建但输入框仍是工作区选择器。因此这里自动在 DSH 根目录下复用/创建
      // 「临时对话」工作区（路径由宿主通过 settings 下发），再走 DSH 原生
      // startSession(workspaceId) 打开空白会话；随后 sessions.list 变化会触发
      // applyStaged 选中对应员工。记录因此集中、可翻找。
      function startWithoutWorkspace(id) {
        if (!createWorkspace) {
          startSession();
          return;
        }
        setBusy(true);
        setError(null);
        admin.load(api).then(function (a) {
          var tempPath = a.tempWorkspacePath;
          if (tempPath) return tempPath;
          // 兜底：老数据没有路径时退回宿主 cwd
          if (!api || !api.host) throw new Error("host unavailable");
          return api.host.describe({}).then(function (resp) {
            var base = resp && resp.result && resp.result.ok && resp.result.value ? resp.result.value.cwd : undefined;
            if (!base) throw new Error("host.describe: no cwd");
            return base;
          });
        }).then(function (dir) {
          return createWorkspace(dir).then(function (ws) {
            // 起个清晰的名字（失败不阻塞）
            if (api && api.workspace && typeof api.workspace.rename === "function") {
              api.workspace.rename({ workspaceId: ws.workspaceId, title: "临时对话" }).catch(function () {});
            }
            return ws;
          });
        }).then(function (ws) {
          setBusy(false);
          startSession(ws.workspaceId);
        }).catch(function (e) {
          setBusy(false);
          setError(messageOf(e));
          startSession();
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

