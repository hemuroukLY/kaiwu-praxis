/* client-src/60-capability.js — 对话页能力卡 / WorkerDock */
    // ---------------------------------------------------------------------
    // 对话页：能力卡片（选中员工未发消息时，挂在输入框上方 dock；
    // 发过消息后缩成输入框左上角小头像，hover 浮出同一张卡片）。
    // ---------------------------------------------------------------------
    function CapabilityCard(props) {
      var preset = props.preset;
      var t = props.t;
      var counts = props.counts;
      var meta = WORKER_META[preset.id] || { role: "", icon: (preset.name || preset.id).charAt(0), gradient: "linear-gradient(135deg,#0f766e,#14b8a6)", zi: 0, skill: 0, sop: 0, tags: [] };
      var tags = meta.tags || [];
      var zi = counts && typeof counts.zi === "number" ? counts.zi : meta.zi;
      var skill = counts && typeof counts.skill === "number" ? counts.skill : meta.skill;
      var sop = counts && typeof counts.sop === "number" ? counts.sop : meta.sop;
      return React.createElement("div", { className: "kwp-chatCard", "data-kwp-capability": "" },
        React.createElement("div", { className: "kwp-chatHead" },
          React.createElement("span", { className: "kwp-chatAvatar", style: { background: meta.av ? "transparent" : meta.gradient } }, kwAvatar(meta)),
          React.createElement("span", { className: "kwp-chatId" },
            React.createElement("span", { className: "kwp-chatName" }, preset.name || preset.id),
            React.createElement("span", { className: "kwp-chatRole" }, meta.role)
          )
        ),
        preset.description ? React.createElement("div", { className: "kwp-chatDesc" }, preset.description) : null,
        tags.length > 0
          ? React.createElement("div", { className: "kwp-chatTags" },
              tags.slice(0, 3).map(function (tag) {
                return React.createElement("span", { key: tag, className: "kwp-chatTag" }, tag);
              })
            )
          : null,
        React.createElement("div", { className: "kwp-chatStats" },
          React.createElement("div", { className: "kwp-chatStat" },
            React.createElement("strong", { className: "kwp-chatStatValue" }, String(zi)),
            React.createElement("em", { className: "kwp-chatStatLabel" }, t("zi"))
          ),
          React.createElement("div", { className: "kwp-chatStat" },
            React.createElement("strong", { className: "kwp-chatStatValue" }, String(skill)),
            React.createElement("em", { className: "kwp-chatStatLabel" }, t("skill"))
          ),
          React.createElement("div", { className: "kwp-chatStat" },
            React.createElement("strong", { className: "kwp-chatStatValue" }, String(sop)),
            React.createElement("em", { className: "kwp-chatStatLabel" }, t("sop"))
          )
        )
      );
    }

    function kaiwuPresetId(props) {
      var sessionId = props.sessionId;
      var useSessions = props.useSessions;
      if (sessionId === undefined || !useSessions) return undefined;
      return useSessions(function (s) {
        var row = s && s.byId ? s.byId[sessionId] : undefined;
        return row ? sessionAgentPreset(row) : undefined;
      });
    }

    function useRosterReady(api, presetId) {
      var _t = React.useState(0);
      var setTick = _t[1];
      React.useEffect(function () {
        if (presetId === undefined || !/^kaiwu-/.test(presetId)) return;
        if (rosterCache.ready || !api || !api.agentPresets) return;
        var alive = true;
        rosterCache.load(api).then(function () {
          if (alive) setTick(function (n) { return n + 1; });
        }).catch(function () {});
        return function () { alive = false; };
      }, [api, presetId]);
    }

    function WorkerChip(props) {
      var preset = props.preset;
      var t = props.t;
      var counts = props.counts;
      var meta = WORKER_META[preset.id] || { icon: (preset.name || preset.id).charAt(0), gradient: "linear-gradient(135deg,#0f766e,#14b8a6)" };
      var _h = React.useState(false);
      var hover = _h[0];
      var setHover = _h[1];
      return React.createElement("span", {
        className: "kwp-workerChip",
        onMouseEnter: function () { setHover(true); },
        onMouseLeave: function () { setHover(false); },
        children: [
          React.createElement("button", {
            type: "button",
            className: "kwp-workerBtn",
            style: { background: meta.av ? "transparent" : meta.gradient },
            "aria-label": preset.name || preset.id,
            "aria-haspopup": "dialog",
            "aria-expanded": hover,
            title: preset.name || preset.id,
            onClick: function () { setHover(function (h) { return !h; }); }
          }, kwAvatar(meta)),
          hover ? React.createElement("div", { className: "kwp-workerPop" },
            React.createElement(CapabilityCard, { preset: preset, t: t, counts: counts })
          ) : null
        ]
      });
    }

    function WorkerDock(props) {
      var t = props.t;
      var api = props.api;
      var presetId = kaiwuPresetId(props);
      // DSH 已不再提供 session.composerPhase；用 blank / awaitingFirstTurn 判断「未开聊」。
      var showCapability = props.useSession
        ? props.useSession(function (s) {
            if (!s) return false;
            if (s.composerPhase === "blank") return true;
            if (s.blank === true) return true;
            if (s.awaitingFirstTurn === true) return true;
            return false;
          })
        : false;
      var admin = useAdminData(api);
      useRosterReady(api, presetId);
      if (presetId === undefined || !/^kaiwu-/.test(presetId)) return null;
      var preset = rosterCache.byId[presetId];
      if (!preset) return null;
      var w = admin.workers ? admin.workers[presetId] : undefined;
      var counts = w ? { zi: (w.knowledge || []).length, skill: (w.skills || []).filter(function (item) { return item.enabled !== false && item.deleted !== true; }).length, sop: (w.sops || []).length } : undefined;
      if (showCapability) return React.createElement(CapabilityCard, { preset: preset, t: t, counts: counts });
      return React.createElement("div", { className: "kwp-workerDockRow" },
        React.createElement(WorkerChip, { preset: preset, t: t, counts: counts })
      );
    }

