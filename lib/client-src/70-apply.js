/* client-src/70-apply.js — cordis apply 入口与导出 */
    // ---------------------------------------------------------------------
    // cordis 客户端插件。
    // ---------------------------------------------------------------------
    // DSH 规范：必须 slots.inject('shell.overlay', () => slots.register(...))
    // 只 register 不 inject 时，overlay 不会进 AppFrame，表现为「数字员工广场点了没反应」。
    var inject = ["slots", "locale", "connection", "remote", "remote.agentPresets", "remote.settings"];

    function apply(ctx) {
      var ReactDOM = null;
      try { ReactDOM = require("react-dom"); } catch (_e) { ReactDOM = null; }

      // 尽早过滤模式座位名录，赶在 ui-agent-preset 首次 list 之前。
      ctx.inject(["remote", "remote.agentPresets"], function (scope) {
        installAgentPresetModeFilter(scope.remote);
      });

      ctx.effect(function () {
        ctx.locale.register("kaiwu.praxis", { zh: zh, en: en });
      }, "kaiwu-praxis: plaza locale");

      ctx.effect(function () {
        return mountPlazaEntry(ctx.locale.bind("kaiwu.praxis"));
      }, "kaiwu-praxis: sidebar plaza entry");

      ctx.effect(function () {
        return mountBrandSwap();
      }, "kaiwu-praxis: native brand swap");

      ctx.inject(["slots", "sessions", "connection", "remote", "remote.agentPresets", "remote.settings"], function (scope) {
        var workspacesApi = null;
        var uiWorkspaceApi = null;
        var fallbackHost = null;
        var fallbackRoot = null;

        // 模式座位读 remote.agentPresets.list：滤掉数字员工，只留 Standard/PTC/… 默认模式。
        installAgentPresetModeFilter(scope.remote);

        scope.effect(function () {
          return mountModeSeatGuard(scope.sessions);
        }, "kaiwu-praxis: hide mode seat when kaiwu worker active");

        function resolveApi() {
          return wrapRemoteAsApi(scope.remote)
            || (scope.connection && scope.connection.api)
            || undefined;
        }

        function plazaProps() {
          return {
            api: resolveApi(),
            sessions: scope.sessions,
            t: ctx.locale.bind("kaiwu.praxis"),
            startSession: function (workspaceId) {
              if (uiWorkspaceApi && typeof uiWorkspaceApi.startSession === "function") {
                uiWorkspaceApi.startSession(workspaceId);
                return;
              }
              if (workspacesApi && typeof workspacesApi.startSession === "function") {
                workspacesApi.startSession(workspaceId);
                return;
              }
              if (scope.sessions && typeof scope.sessions.create === "function") {
                scope.sessions.create(workspaceId ? { workspaceId: workspaceId } : {});
              }
            },
            createWorkspace: function (path) {
              if (workspacesApi && typeof workspacesApi.create === "function") {
                return workspacesApi.create({ path: path });
              }
              return Promise.reject(new Error("workspaces.create unavailable"));
            },
            renameWorkspace: function (workspaceId, title) {
              if (workspacesApi && typeof workspacesApi.rename === "function") {
                return workspacesApi.rename(workspaceId, title);
              }
              var api = resolveApi();
              if (api && api.workspace && typeof api.workspace.rename === "function") {
                return api.workspace.rename({ workspaceId: workspaceId, title: title }).then(function (resp) {
                  if (!resp.result || !resp.result.ok) {
                    throw new Error((resp.result && resp.result.error && resp.result.error.message) || "rename failed");
                  }
                  return resp.result.value;
                });
              }
              return Promise.reject(new Error("workspaces.rename unavailable"));
            },
            // 在指定工作区内创建/复用空白会话 → 选中员工 → 打开该会话（避免会话落在别的工作区）。
            openWorkerSession: function (workspaceId, workerId) {
              var api = resolveApi();
              if (!api || !api.agentPresets) return Promise.reject(new Error("agentPresets unavailable"));
              function archiveUngrouped(keepSessionId) {
                var archiveFn = null;
                if (uiWorkspaceApi && typeof uiWorkspaceApi.archiveSession === "function") {
                  archiveFn = function (id) { return uiWorkspaceApi.archiveSession(id); };
                } else if (workspacesApi && typeof workspacesApi.archiveSession === "function") {
                  archiveFn = function (id) { return workspacesApi.archiveSession(id); };
                }
                if (!archiveFn || !scope.sessions || !scope.sessions.list || !workspacesApi || !workspacesApi.list) {
                  return Promise.resolve();
                }
                var sessionsSnap = scope.sessions.list.getSnapshot();
                var wsSnap = workspacesApi.list.getSnapshot();
                if (!sessionsSnap || !wsSnap || !wsSnap.items) return Promise.resolve();
                var inWorkspace = {};
                for (var i = 0; i < wsSnap.items.length; i++) {
                  var ids = wsSnap.items[i].sessionIds || [];
                  for (var j = 0; j < ids.length; j++) inWorkspace[ids[j]] = true;
                }
                var archived = {};
                var archList = wsSnap.archivedSessionIds || [];
                for (var a = 0; a < archList.length; a++) archived[archList[a]] = true;
                var toArchive = [];
                for (var n = 0; n < (sessionsSnap.ids || []).length; n++) {
                  var sid = sessionsSnap.ids[n];
                  if (!sid || sid === keepSessionId) continue;
                  if (inWorkspace[sid] || archived[sid]) continue;
                  // 未分组（不属于任何工作区）的旧会话，归档以免侧栏出现第二个「工作区」观感。
                  toArchive.push(sid);
                }
                // 串行归档：与删除工作区路径一致，避免 archivedSessionIds 竞态覆盖。
                return toArchive.reduce(function (chain, id) {
                  return chain.then(function () {
                    return Promise.resolve(archiveFn(id)).catch(function () {});
                  });
                }, Promise.resolve());
              }
              function selectAndOpen(sessionId) {
                return api.agentPresets.select({ sessionId: sessionId, agentPreset: workerId }).then(function (resp) {
                  if (!resp.result || !resp.result.ok) {
                    throw new Error((resp.result && resp.result.error && resp.result.error.message) || "select failed");
                  }
                  if (scope.sessions && typeof scope.sessions.open === "function") {
                    scope.sessions.open(sessionId);
                  }
                  return archiveUngrouped(sessionId).then(function () { return sessionId; });
                });
              }
              if (uiWorkspaceApi && typeof uiWorkspaceApi.connectWorkspace === "function") {
                return uiWorkspaceApi.connectWorkspace(workspaceId).then(selectAndOpen);
              }
              if (scope.sessions && typeof scope.sessions.create === "function") {
                return Promise.resolve(scope.sessions.create({ workspaceId: workspaceId })).then(selectAndOpen);
              }
              return Promise.reject(new Error("uiWorkspace.connectWorkspace unavailable"));
            }
          };
        }

        function unmountFallback() {
          if (fallbackRoot && typeof fallbackRoot.unmount === "function") {
            fallbackRoot.unmount();
            fallbackRoot = null;
          } else if (ReactDOM && fallbackHost && ReactDOM.unmountComponentAtNode) {
            ReactDOM.unmountComponentAtNode(fallbackHost);
          }
          if (fallbackHost && fallbackHost.parentNode) fallbackHost.parentNode.removeChild(fallbackHost);
          fallbackHost = null;
        }

        function mountFallback() {
          if (!ReactDOM || typeof document === "undefined") return;
          if (!fallbackHost) {
            fallbackHost = document.createElement("div");
            fallbackHost.id = "kaiwu-plaza-fallback-host";
            fallbackHost.setAttribute("data-kaiwu-plaza-fallback", "true");
            document.body.appendChild(fallbackHost);
            if (typeof ReactDOM.createRoot === "function") {
              fallbackRoot = ReactDOM.createRoot(fallbackHost);
            }
          }
          var el = React.createElement(PlazaOverlay, plazaProps());
          if (fallbackRoot) fallbackRoot.render(el);
          else if (ReactDOM.render) ReactDOM.render(el, fallbackHost);
        }

        // slot 正确挂载
        var disposeOverlayInject = scope.slots.inject("shell.overlay", function () {
          return scope.slots.register({
            name: "shell.overlay",
            id: "kaiwu-plaza",
            order: 0,
            locale: "kaiwu.praxis",
            inject: plazaProps
          }, PlazaOverlay);
        });

        var disposeDockInject = scope.slots.inject("conversation.input.dock", function () {
          return scope.slots.register({
            name: "conversation.input.dock",
            id: "kaiwu-capability",
            order: 0,
            locale: "kaiwu.praxis",
            inject: function () { return { api: resolveApi() }; }
          }, WorkerDock);
        });

        // 若 slot 层仍未渲染出 .kwp-fixed，用 body portal 兜底，避免「点了没反应」。
        // slot 随后追上时卸载 fallback，防止双挂载。
        var fallbackWatchTimer = null;
        function stopFallbackWatch() {
          if (fallbackWatchTimer !== null) {
            clearInterval(fallbackWatchTimer);
            fallbackWatchTimer = null;
          }
        }
        function slotPlazaMounted() {
          var nodes = document.querySelectorAll(".kwp-fixed");
          for (var i = 0; i < nodes.length; i++) {
            if (!fallbackHost || !fallbackHost.contains(nodes[i])) return true;
          }
          return false;
        }
        var unsubPlaza = plazaStore.subscribe(function (open) {
          if (!open) {
            stopFallbackWatch();
            unmountFallback();
            return;
          }
          setTimeout(function () {
            if (!plazaStore.open) return;
            if (slotPlazaMounted()) {
              unmountFallback();
              return;
            }
            mountFallback();
            stopFallbackWatch();
            var tries = 0;
            fallbackWatchTimer = setInterval(function () {
              tries += 1;
              if (!plazaStore.open || slotPlazaMounted() || tries > 40) {
                if (slotPlazaMounted()) unmountFallback();
                stopFallbackWatch();
              }
            }, 100);
          }, 80);
        });

        // 确认框文案与真实行为对齐：删除后会话不再出现在「未分组」。
        var restoreLocaleTranslate = null;
        if (ctx.locale && typeof ctx.locale.translate === "function" && !ctx.locale.__kaiwuDeleteDescPatched) {
          var origTranslate = ctx.locale.translate.bind(ctx.locale);
          ctx.locale.translate = function (ns, key, params) {
            if (ns === "workspace" && key === "delete.desc") {
              var name = params && params.name != null ? String(params.name) : "";
              if (ctx.locale.snapshot && String(ctx.locale.snapshot.active || "").toLowerCase().indexOf("zh") === 0) {
                return "将把“" + name + "”从工作区列表中移除。相关会话将一并隐藏，不再显示在侧边栏。";
              }
              return "This removes “" + name + "” from the workspace list. Its sessions will be hidden and will not appear in the sidebar.";
            }
            return origTranslate(ns, key, params);
          };
          ctx.locale.__kaiwuDeleteDescPatched = true;
          restoreLocaleTranslate = function () {
            if (ctx.locale.translate !== origTranslate) {
              ctx.locale.translate = origTranslate;
            }
            try { delete ctx.locale.__kaiwuDeleteDescPatched; } catch (_e) { ctx.locale.__kaiwuDeleteDescPatched = false; }
          };
        }

        ctx.inject(["workspaces", "uiWorkspace"], function (wscope) {
          workspacesApi = wscope.workspaces;
          uiWorkspaceApi = wscope.uiWorkspace;
          // 删除工作区前先串行归档其会话，避免并行归档竞态，且避免会话掉进「未分组」。
          if (workspacesApi && typeof workspacesApi.delete === "function" && !workspacesApi.__kaiwuDeleteWrapped) {
            var origDelete = workspacesApi.delete.bind(workspacesApi);
            workspacesApi.delete = function (workspaceId) {
              var snap = workspacesApi.list && workspacesApi.list.getSnapshot
                ? workspacesApi.list.getSnapshot()
                : null;
              var items = snap && snap.items ? snap.items : [];
              var target = null;
              for (var i = 0; i < items.length; i++) {
                if (items[i].workspaceId === workspaceId) { target = items[i]; break; }
              }
              var sessionIds = target && target.sessionIds ? target.sessionIds.slice() : [];
              function archiveOne(sid) {
                if (uiWorkspaceApi && typeof uiWorkspaceApi.archiveSession === "function") {
                  return uiWorkspaceApi.archiveSession(sid);
                }
                if (typeof workspacesApi.archiveSession === "function") {
                  return workspacesApi.archiveSession(sid);
                }
                return Promise.resolve();
              }
              // 串行归档：服务端每次返回完整 archivedSessionIds，并行会互相覆盖。
              return sessionIds.reduce(function (chain, sid) {
                return chain.then(function () {
                  return Promise.resolve(archiveOne(sid)).catch(function () {});
                });
              }, Promise.resolve()).then(function () {
                return origDelete(workspaceId);
              });
            };
            workspacesApi.__kaiwuDeleteWrapped = true;
          }
        });

        scope.effect(function () {
          return function () {
            stopFallbackWatch();
            unsubPlaza();
            unmountFallback();
            if (typeof restoreLocaleTranslate === "function") restoreLocaleTranslate();
            if (typeof disposeOverlayInject === "function") disposeOverlayInject();
            if (typeof disposeDockInject === "function") disposeDockInject();
          };
        }, "kaiwu-praxis: plaza slot cleanup");
      });
    }

    exports.name = "kaiwu-praxis";
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
