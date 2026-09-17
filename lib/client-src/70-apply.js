/* client-src/70-apply.js — cordis apply 入口与导出 */
    // ---------------------------------------------------------------------
    // cordis 客户端插件。
    // ---------------------------------------------------------------------
    var inject = ["slots", "locale", "connection"];

    function apply(ctx) {
      ctx.effect(function () {
        ctx.locale.register("kaiwu.praxis", { zh: zh, en: en });
      }, "kaiwu-praxis: plaza locale");

      ctx.effect(function () {
        return mountPlazaEntry(ctx.locale.bind("kaiwu.praxis"));
      }, "kaiwu-praxis: sidebar plaza entry");

      ctx.effect(function () {
        return mountBrandSwap();
      }, "kaiwu-praxis: native brand swap");

      ctx.inject(["slots", "sessions", "workspaces"], function (scope) {
        var api = scope.get("connection") ? scope.get("connection").api : undefined;
        scope.effect(function () {
          var disposeOverlay = scope.slots.inject("shell.overlay", function () {
            return scope.slots.register({
              name: "shell.overlay",
              id: "kaiwu-plaza",
              order: 0,
              locale: "kaiwu.praxis",
              inject: function () {
                return {
                  api: api,
                  sessions: scope.sessions,
                  startSession: function (workspaceId) {
                    if (scope.workspaces && typeof scope.workspaces.startSession === "function") {
                      scope.workspaces.startSession(workspaceId);
                    }
                  },
                  createWorkspace: function (path) {
                    if (scope.workspaces && typeof scope.workspaces.create === "function") {
                      return scope.workspaces.create({ path: path });
                    }
                    return Promise.reject(new Error("workspaces.create unavailable"));
                  }
                };
              }
            }, PlazaOverlay);
          });
          var disposeDock = scope.slots.inject("conversation.input.dock", function () {
            return scope.slots.register({
              name: "conversation.input.dock",
              id: "kaiwu-capability",
              order: 0,
              locale: "kaiwu.praxis",
              inject: function () { return { api: api }; }
            }, WorkerDock);
          });
          return function () {
            disposeOverlay();
            disposeDock();
          };
        }, "kaiwu-praxis: worker chat chrome");
      });
    }

    exports.name = "kaiwu-praxis";
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
