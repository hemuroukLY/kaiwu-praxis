/* client-src/50-admin-panel.js — 员工设置 AdminPanel */
    // ---------------------------------------------------------------------
    // 员工设置：员工档案、真实会话统计、任务计划与能力资产。
    // ---------------------------------------------------------------------
    function AdminPanel(props) {
      var api = props.api;
      var t = props.t;
      var admin = props.admin;
      var sessions = props.sessions;

      var _sel = React.useState("kaiwu-watermark");
      var selectedId = _sel[0];
      var setSelectedId = _sel[1];
      var _tab = React.useState("profile");
      var tab = _tab[0];
      var setTab = _tab[1];
      var _ed = React.useState(null);
      var editing = _ed[0];
      var setEditing = _ed[1];
      var _busy = React.useState(false);
      var busy = _busy[0];
      var setBusy = _busy[1];
      var _err = React.useState(null);
      var saveError = _err[0];
      var setSaveError = _err[1];
      var _sessionTick = React.useState(0);
      var setSessionTick = _sessionTick[1];
      var _hubUrl = React.useState("");
      var hubUrl = _hubUrl[0];
      var setHubUrl = _hubUrl[1];
      var _enrollmentCode = React.useState("");
      var enrollmentCode = _enrollmentCode[0];
      var setEnrollmentCode = _enrollmentCode[1];
      var _terminalName = React.useState("");
      var terminalName = _terminalName[0];
      var setTerminalName = _terminalName[1];

      React.useEffect(function () {
        if (!sessions || !sessions.list) return;
        return sessions.list.subscribe(function () { setSessionTick(function (n) { return n + 1; }); });
      }, [sessions]);

      React.useEffect(function () {
        var enterprise = admin.enterprise || {};
        setHubUrl(enterprise.hubUrl || "http://127.0.0.1:3099");
        setEnrollmentCode(enterprise.enrollmentCode || "");
        setTerminalName(enterprise.terminalName || "");
      }, [admin.revision]);

      function saveEnterpriseConnection() {
        setBusy(true);
        setSaveError(null);
        admin.replaceEnterprise(api, Object.assign({}, admin.enterprise || {}, {
          hubUrl: hubUrl.trim(),
          enrollmentCode: enrollmentCode.trim(),
          terminalName: terminalName.trim(),
          status: "等待连接",
          lastError: ""
        })).then(function () {
          setBusy(false);
        }).catch(function (e) {
          setBusy(false);
          setSaveError(messageOf(e));
        });
      }

      function ensureWorker(id) {
        var w = admin.workers ? admin.workers[id] : undefined;
        var profile = Object.assign({
          staffNo: "",
          roleName: "",
          description: "",
          personaPrompt: "",
          summary: "",
          owner: "admin",
          department: "运营中心",
          joinedAt: "",
          workStyles: [],
          expertiseTags: [],
          workModes: []
        }, (w && w.profile) || {});
        if (!profile.roleName && profile.title) profile.roleName = profile.title;
        if (!profile.personaPrompt) {
          var legacy = [profile.boundary, profile.style].filter(Boolean).join("\n");
          if (legacy) profile.personaPrompt = legacy;
        }
        profile.workStyles = Array.isArray(profile.workStyles) ? profile.workStyles : [];
        profile.expertiseTags = Array.isArray(profile.expertiseTags) ? profile.expertiseTags : [];
        profile.workModes = Array.isArray(profile.workModes) ? profile.workModes : [];
        return {
          profile: profile,
          knowledge: ((w && w.knowledge) || []).slice(),
          memories: ((w && w.memories) || []).slice(),
          sops: ((w && w.sops) || []).slice(),
          tasks: ((w && w.tasks) || []).slice(),
          skills: ((w && w.skills) || []).map(function (item, i) { return Object.assign({ id: "skill-" + (i + 1), enabled: true, deleted: false, source: "package", baseVersion: "0.2.0", packageVersion: "0.2.0", localRevision: 0, modified: false }, item); }),
          tools: ((w && w.tools) || []).map(function (item) { return Object.assign({ id: item.name, enabled: true, baseVersion: "0.2.0", packageVersion: "0.2.0", localRevision: 0, modified: false }, item); })
        };
      }

      function tagsToText(tags) {
        return (Array.isArray(tags) ? tags : []).join("，");
      }

      function textToTags(value) {
        return String(value || "").split(/[,，]/).map(function (item) { return item.trim(); }).filter(Boolean);
      }

      function patchProfile(patch) {
        setEditing({ kind: "profile", profile: Object.assign({}, editing.profile, patch) });
      }

      function capabilitySummaryOf(w) {
        var skills = (w.skills || []).filter(function (item) { return item && item.enabled !== false && item.deleted !== true; });
        var tools = (w.tools || []).filter(function (item) { return item && item.enabled !== false; });
        var tasks = (w.tasks || []).filter(function (item) { return item && item.enabled !== false; });
        return {
          skillCount: skills.length,
          knowledgeCount: (w.knowledge || []).length,
          toolCount: tools.length,
          sopCount: (w.sops || []).length,
          taskCount: tasks.length,
          skillNames: skills.map(function (item) { return item.name || item.id; }).filter(Boolean),
          knowledgeNames: (w.knowledge || []).map(function (item) { return item.name; }).filter(Boolean),
          toolNames: tools.map(function (item) { return item.name || item.id; }).filter(Boolean),
          sopNames: (w.sops || []).map(function (item) { return item.name; }).filter(Boolean),
          taskNames: tasks.map(function (item) { return item.name; }).filter(Boolean)
        };
      }

      function growthTimelineOf(w) {
        var events = [];
        function stamp(item) {
          var meta = item && item.metadata || {};
          var candidates = [meta.learned_at, meta.assigned_at, meta.installed_at, meta.imported_at, meta.created_at, item.createdAt, item.created_at, item.updatedAt, item.updated_at];
          for (var i = 0; i < candidates.length; i += 1) {
            if (typeof candidates[i] === "string" && candidates[i].trim() && !Number.isNaN(Date.parse(candidates[i]))) return candidates[i];
          }
          return "";
        }
        (w.sops || []).forEach(function (item, index) {
          events.push({ id: "sop-" + (item.name || index), kind: "新增 SOP", title: item.name || ("SOP " + (index + 1)), timestamp: stamp(item) });
        });
        (w.skills || []).filter(function (item) { return item && item.enabled !== false && item.deleted !== true; }).forEach(function (item, index) {
          var upgraded = (Number(item.localRevision) || 0) > 0 || item.modified === true;
          events.push({
            id: "skill-" + (item.id || item.name || index),
            kind: upgraded ? "技能升级" : "新增技能",
            title: item.name || item.id || ("技能 " + (index + 1)),
            timestamp: stamp(item)
          });
        });
        (w.tools || []).filter(function (item) { return item && item.enabled !== false; }).forEach(function (item, index) {
          events.push({
            id: "tool-" + (item.id || item.name || index),
            kind: "新增工具",
            title: item.name || item.id || ("工具 " + (index + 1)),
            timestamp: stamp(item)
          });
        });
        return events.filter(function (item) { return item.title && item.timestamp && !Number.isNaN(Date.parse(item.timestamp)); })
          .sort(function (a, b) { return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(); });
      }

      function formatGrowthStamp(value) {
        if (!value) return "—";
        if (/^v/i.test(value)) return value;
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return (date.getMonth() + 1) + "." + date.getDate();
      }

      function chipRow(items) {
        if (!items || !items.length) return React.createElement("span", { className: "kwp-profileChipEmpty" }, t("noneYet"));
        return React.createElement("div", { className: "kwp-profileChips" }, items.slice(0, 6).map(function (item) {
          return React.createElement("span", { key: item, className: "kwp-profileChip" }, item);
        }));
      }

      function persistWorker(nextWorker) {
        var workers = {};
        for (var k in admin.workers) workers[k] = admin.workers[k];
        workers[selectedId] = nextWorker;
        setBusy(true);
        setSaveError(null);
        admin.replace(api, workers).then(function () {
          setBusy(false);
          setEditing(null);
        }).catch(function (e) {
          setBusy(false);
          setSaveError(messageOf(e));
        });
      }

      function startEdit(kind, index, doc) {
        if (kind === "profile") return;
        if (kind === "tasks") setEditing({ kind: kind, index: index, name: doc ? doc.name : "", schedule: doc ? doc.schedule : "", prompt: doc ? doc.prompt : "", enabled: doc ? doc.enabled !== false : true });
        else if (kind === "skills") setEditing({ kind: kind, index: index, name: doc ? doc.name : "", description: doc ? doc.description : "", content: doc ? doc.content : "" });
        else setEditing({ kind: kind, index: index, name: doc ? doc.name : "", content: doc ? doc.content : "" });
      }

      function saveEdit() {
        if (!editing || editing.kind === "profile") return;
        var w = ensureWorker(selectedId);
        if (editing.kind === "tasks") {
          var task = { name: editing.name.trim() || "未命名任务", schedule: editing.schedule.trim(), prompt: editing.prompt, enabled: editing.enabled !== false };
          if (editing.index >= 0) w.tasks[editing.index] = task; else w.tasks.push(task);
          persistWorker(w); return;
        }
        if (editing.kind === "skills") {
          var previous = editing.index >= 0 ? w.skills[editing.index] : null;
          var nowIso = new Date().toISOString();
          var skill = Object.assign({}, previous || {}, {
            id: previous ? previous.id : "local-" + Date.now(),
            name: editing.name.trim() || "未命名技能",
            description: editing.description.trim(),
            content: editing.content,
            enabled: previous ? previous.enabled !== false : true,
            deleted: false,
            source: previous ? previous.source : "local",
            baseVersion: previous ? previous.baseVersion : "",
            packageVersion: previous ? previous.packageVersion : "",
            localRevision: (previous ? Number(previous.localRevision) || 0 : 0) + 1,
            modified: true,
            createdAt: previous && previous.createdAt ? previous.createdAt : nowIso,
            updatedAt: nowIso
          });
          if (editing.index >= 0) w.skills[editing.index] = skill; else w.skills.push(skill);
          persistWorker(w); return;
        }
        var arr = editing.kind === "knowledge" ? w.knowledge : editing.kind === "memories" ? w.memories : w.sops;
        var nowDoc = new Date().toISOString();
        var previousDoc = editing.index >= 0 ? arr[editing.index] : null;
        var doc = {
          name: editing.name.trim() === "" ? "未命名" : editing.name.trim(),
          content: editing.content,
          createdAt: previousDoc && previousDoc.createdAt ? previousDoc.createdAt : nowDoc,
          updatedAt: nowDoc
        };
        if (editing.index >= 0) arr[editing.index] = doc;
        else arr.push(doc);
        if (editing.kind === "knowledge") w.knowledge = arr;
        else if (editing.kind === "memories") w.memories = arr;
        else w.sops = arr;
        persistWorker(w);
      }

      function deleteDoc(kind, index) {
        var w = ensureWorker(selectedId);
        var arr = kind === "knowledge" ? w.knowledge : kind === "memories" ? w.memories : kind === "tasks" ? w.tasks : w.sops;
        arr.splice(index, 1);
        if (kind === "knowledge") w.knowledge = arr;
        else if (kind === "memories") w.memories = arr;
        else if (kind === "tasks") w.tasks = arr;
        else w.sops = arr;
        persistWorker(w);
      }

      function toggleTask(index) {
        var w = ensureWorker(selectedId);
        w.tasks[index] = Object.assign({}, w.tasks[index], { enabled: w.tasks[index].enabled === false });
        persistWorker(w);
      }

      function toggleSkill(index) {
        var w = ensureWorker(selectedId);
        var current = w.skills[index];
        w.skills[index] = Object.assign({}, current, { enabled: current.enabled === false, deleted: false, localRevision: (Number(current.localRevision) || 0) + 1 });
        persistWorker(w);
      }

      function deleteSkill(index) {
        var w = ensureWorker(selectedId);
        var current = w.skills[index];
        if (current.source === "local") w.skills.splice(index, 1);
        else w.skills[index] = Object.assign({}, current, { enabled: false, deleted: true, localRevision: (Number(current.localRevision) || 0) + 1 });
        persistWorker(w);
      }

      function restoreSkill(index) {
        var w = ensureWorker(selectedId);
        var current = w.skills[index];
        w.skills[index] = Object.assign({}, current, { enabled: true, deleted: false, localRevision: (Number(current.localRevision) || 0) + 1 });
        persistWorker(w);
      }

      function toggleTool(index) {
        var w = ensureWorker(selectedId);
        var current = w.tools[index];
        var nextEnabled = current.enabled === false;
        w.tools[index] = Object.assign({}, current, { enabled: nextEnabled, modified: nextEnabled === false, localRevision: (Number(current.localRevision) || 0) + 1 });
        persistWorker(w);
      }

      function openPresetDir() {
        if (!api || !api.agentPresets) return;
        api.agentPresets.openDocument({ agentPreset: selectedId }).then(function (resp) {
          if (!resp.result.ok) setSaveError(resp.result.error.message);
        }).catch(function (e) { setSaveError(messageOf(e)); });
      }

      if (!admin.ready) {
        return React.createElement("div", { className: "kwp-adminRoot" },
          React.createElement("div", { className: "kwp-adminEmpty" },
            admin.error === "namespace-missing" ? t("adminNotReady") : t("adminLoading")
          )
        );
      }

      var worker = ensureWorker(selectedId);
      var rosterEntry = rosterCache.byId[selectedId];
      var workerName = rosterEntry ? rosterEntry.name || rosterEntry.id : selectedId;
      var meta = WORKER_META[selectedId] || { role: "", icon: workerName.charAt(0), gradient: "linear-gradient(135deg,#0f766e,#14b8a6)" };
      var snapshot = sessions && sessions.list ? sessions.list.getSnapshot() : { ids: [], byId: {} };
      var sessionRows = (snapshot.ids || []).map(function (id) { return snapshot.byId[id]; }).filter(function (row) { return row && row.agentPreset === selectedId && !row.blank; }).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      var todayKey = new Date().toLocaleDateString("zh-CN");
      var todaySessions = sessionRows.filter(function (row) { return new Date(row.updatedAt || 0).toLocaleDateString("zh-CN") === todayKey; });
      var runningSessions = sessionRows.filter(function (row) { return row.running; });

      function formatTime(value) {
        if (!value) return "—";
        try { return new Date(value).toLocaleString("zh-CN", { hour12: false }); } catch (_) { return "—"; }
      }

      function navButton(id, label, icon) {
        return React.createElement("button", {
          type: "button",
          className: "kwp-adminNavItem",
          "data-active": tab === id,
          onClick: function () { setTab(id); setEditing(null); }
        }, React.createElement("span", null, icon), React.createElement("span", null, label));
      }

      function editorForm() {
        if (!editing) return null;
        if (editing.kind === "profile") {
          return React.createElement("div", { className: "kwp-adminEditor", "data-profile-editor": "" },
            React.createElement("div", { className: "kwp-adminProfileForm" },
              React.createElement("label", null, React.createElement("span", null, t("staffNo")), React.createElement("input", { className: "kwp-adminInput", value: editing.profile.staffNo || "", onChange: function (ev) { patchProfile({ staffNo: ev.target.value }); } })),
              React.createElement("label", null, React.createElement("span", null, t("jobTitle")), React.createElement("input", { className: "kwp-adminInput", placeholder: "例如：研发", value: editing.profile.roleName || "", onChange: function (ev) { patchProfile({ roleName: ev.target.value }); } })),
              React.createElement("label", null, React.createElement("span", null, t("joinedAt")), React.createElement("input", { className: "kwp-adminInput", type: "date", value: editing.profile.joinedAt || "", onChange: function (ev) { patchProfile({ joinedAt: ev.target.value }); } })),
              React.createElement("label", null, React.createElement("span", null, t("owner")), React.createElement("input", { className: "kwp-adminInput", value: editing.profile.owner || "", onChange: function (ev) { patchProfile({ owner: ev.target.value }); } })),
              React.createElement("label", null, React.createElement("span", null, t("department")), React.createElement("input", { className: "kwp-adminInput", value: editing.profile.department || "", onChange: function (ev) { patchProfile({ department: ev.target.value }); } })),
              React.createElement("label", { className: "kwp-adminInputWide" }, React.createElement("span", null, t("workStyles") + " · " + t("tagsHint")), React.createElement("input", { className: "kwp-adminInput", value: tagsToText(editing.profile.workStyles), onChange: function (ev) { patchProfile({ workStyles: textToTags(ev.target.value) }); } })),
              React.createElement("label", { className: "kwp-adminInputWide" }, React.createElement("span", null, t("expertiseTags") + " · " + t("tagsHint")), React.createElement("input", { className: "kwp-adminInput", value: tagsToText(editing.profile.expertiseTags), onChange: function (ev) { patchProfile({ expertiseTags: textToTags(ev.target.value) }); } })),
              React.createElement("label", { className: "kwp-adminInputWide" }, React.createElement("span", null, t("workModes") + " · " + t("tagsHint")), React.createElement("input", { className: "kwp-adminInput", value: tagsToText(editing.profile.workModes), onChange: function (ev) { patchProfile({ workModes: textToTags(ev.target.value) }); } })),
              React.createElement("label", null, React.createElement("span", null, t("profileSummary")), React.createElement("textarea", { className: "kwp-adminTextarea", placeholder: "用于档案页顶部展示的摘要", value: editing.profile.summary || "", onChange: function (ev) { patchProfile({ summary: ev.target.value }); } })),
              React.createElement("label", null, React.createElement("span", null, t("roleDescription")), React.createElement("textarea", { className: "kwp-adminTextarea", placeholder: "概括岗位边界、服务风格和执行重点", value: editing.profile.description || "", onChange: function (ev) { patchProfile({ description: ev.target.value }); } })),
              React.createElement("label", null, React.createElement("span", null, t("personaPrompt")), React.createElement("textarea", { className: "kwp-adminTextarea", placeholder: "对话中的角色、人设、回复风格和执行边界", value: editing.profile.personaPrompt || "", onChange: function (ev) { patchProfile({ personaPrompt: ev.target.value }); } }))
            ),
            React.createElement("div", { className: "kwp-adminActions" }, React.createElement("button", { type: "button", className: "kwp-adminBtn", onClick: function () { setEditing(null); } }, t("cancelDoc")), React.createElement("button", { type: "button", className: "kwp-adminBtn kwp-adminBtnPrimary", disabled: busy, onClick: saveEdit }, t("saveProfile")))
          );
        }
        if (editing.kind === "tasks") {
          return React.createElement("div", { className: "kwp-adminEditor" },
            React.createElement("input", { className: "kwp-adminInput", placeholder: t("taskName"), value: editing.name, onChange: function (ev) { setEditing(Object.assign({}, editing, { name: ev.target.value })); } }),
            React.createElement("input", { className: "kwp-adminInput", placeholder: t("taskSchedule"), value: editing.schedule, onChange: function (ev) { setEditing(Object.assign({}, editing, { schedule: ev.target.value })); } }),
            React.createElement("textarea", { className: "kwp-adminTextarea", placeholder: t("taskPrompt"), value: editing.prompt, onChange: function (ev) { setEditing(Object.assign({}, editing, { prompt: ev.target.value })); } }),
            React.createElement("div", { className: "kwp-adminActions" }, React.createElement("button", { type: "button", className: "kwp-adminBtn", onClick: function () { setEditing(null); } }, t("cancelDoc")), React.createElement("button", { type: "button", className: "kwp-adminBtn kwp-adminBtnPrimary", disabled: busy, onClick: saveEdit }, t("saveDoc")))
          );
        }
        if (editing.kind === "skills") {
          return React.createElement("div", { className: "kwp-adminEditor", "data-skill-editor": "" },
            React.createElement("input", { className: "kwp-adminInput", placeholder: t("skillName"), value: editing.name, onChange: function (ev) { setEditing(Object.assign({}, editing, { name: ev.target.value })); } }),
            React.createElement("input", { className: "kwp-adminInput", placeholder: t("skillDescription"), value: editing.description, onChange: function (ev) { setEditing(Object.assign({}, editing, { description: ev.target.value })); } }),
            React.createElement("textarea", { className: "kwp-adminTextarea", placeholder: t("skillContent"), value: editing.content, onChange: function (ev) { setEditing(Object.assign({}, editing, { content: ev.target.value })); } }),
            React.createElement("div", { className: "kwp-adminActions" },
              React.createElement("button", { type: "button", className: "kwp-adminBtn", disabled: busy, onClick: function () { setEditing(null); } }, t("cancelDoc")),
              React.createElement("button", { type: "button", className: "kwp-adminBtn kwp-adminBtnPrimary", disabled: busy, onClick: saveEdit }, t("saveDoc"))
            )
          );
        }
        return React.createElement("div", { className: "kwp-adminEditor" },
          React.createElement("input", {
            className: "kwp-adminInput",
            placeholder: t("docName"),
            value: editing.name,
            onChange: function (ev) { setEditing({ kind: editing.kind, index: editing.index, name: ev.target.value, content: editing.content }); }
          }),
          React.createElement("textarea", {
            className: "kwp-adminTextarea",
            placeholder: t("docContent"),
            value: editing.content,
            onChange: function (ev) { setEditing({ kind: editing.kind, index: editing.index, name: editing.name, content: ev.target.value }); }
          }),
          React.createElement("div", { className: "kwp-adminActions" },
            React.createElement("button", { type: "button", className: "kwp-adminBtn", disabled: busy, onClick: function () { setEditing(null); } }, t("cancelDoc")),
            React.createElement("button", { type: "button", className: "kwp-adminBtn kwp-adminBtnPrimary", disabled: busy, onClick: saveEdit }, t("saveDoc"))
          )
        );
      }

      function docRows(kind, docs, emptyText) {
        if (docs.length === 0) return React.createElement("div", { className: "kwp-adminEmpty" }, emptyText);
        return docs.map(function (doc, i) {
          var preview = String(doc.content || "").split("\n").filter(function (line) { return line.trim() !== ""; })[0] || "";
          return React.createElement("div", { key: i, className: "kwp-adminRow" },
            React.createElement("div", { className: "kwp-adminRowMain" },
              React.createElement("div", { className: "kwp-adminRowTitle" }, doc.name),
              React.createElement("div", { className: "kwp-adminRowDesc" }, preview)
            ),
            React.createElement("button", { type: "button", className: "kwp-adminBtn", disabled: busy, onClick: function () { startEdit(kind, i, doc); } }, t("editDoc")),
            React.createElement("button", { type: "button", className: "kwp-adminBtn", disabled: busy, onClick: function () { deleteDoc(kind, i); } }, t("deleteDoc"))
          );
        });
      }

      function bodyFor(kind) {
        var docs = kind === "knowledge" ? worker.knowledge : kind === "memories" ? worker.memories : worker.sops;
        var emptyText = kind === "knowledge" ? t("emptyKnowledge") : kind === "memories" ? t("emptyMemories") : t("emptySops");
        var children = [
          React.createElement("div", { key: "head", className: "kwp-adminActions", style: { justifyContent: "flex-start" } },
            React.createElement("button", {
              type: "button",
              className: "kwp-adminBtn kwp-adminBtnPrimary",
              disabled: busy,
              onClick: function () { startEdit(kind, -1, null); }
            }, t("addDoc"))
          ),
          editorForm(),
          docRows(kind, docs, emptyText)
        ].filter(Boolean);
        return children;
      }

      function sessionTable(rows, includeId) {
        if (rows.length === 0) return React.createElement("div", { className: "kwp-adminEmpty" }, t("noSessions"));
        return React.createElement("table", { className: "kwp-adminTable" },
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, t("sessionTitle")), React.createElement("th", null, t("updatedAt")), React.createElement("th", null, t("sessionStatus")), includeId ? React.createElement("th", null, t("sessionId")) : null)),
          React.createElement("tbody", null, rows.slice(0, 30).map(function (row) {
            return React.createElement("tr", { key: row.id }, React.createElement("td", null, row.displayTitle || row.title || row.id), React.createElement("td", null, formatTime(row.updatedAt)), React.createElement("td", null, React.createElement("span", { className: "kwp-adminBadge", "data-running": row.running }, row.running ? t("running") : t("completed"))), includeId ? React.createElement("td", { title: row.id }, String(row.id).slice(0, 12) + "…") : null);
          }))
        );
      }

      var body = null;
      if (tab === "enterprise") {
        var enterprise = admin.enterprise || {};
        body = React.createElement("div", { className: "kwp-enterpriseConnection", "data-enterprise-connection": "" },
          React.createElement("details", { className: "kwp-guide", "data-employee-enterprise-guide": "" },
            React.createElement("summary", null, "使用引导"),
            React.createElement("div", { className: "kwp-guideBody" },
              React.createElement("ol", null,
                React.createElement("li", null, "向企业管理员获取企业中枢地址和一次性注册码。"),
                React.createElement("li", null, "填写地址、注册码和便于识别的终端名称，然后点击“保存并连接”。"),
                React.createElement("li", null, "连接状态变为“已连接”并显示终端 ID 后，企业端即可看到本机。"),
                React.createElement("li", null, "短暂断网不会影响本地使用；恢复网络后会自动重连并继续执行排队配置。")
              ),
              React.createElement("p", null, "若一直显示未注册或连接失败，请检查中枢地址是否能从本机访问、注册码是否过期，以及企业端是否正在运行。")
            )
          ),
          React.createElement("div", { className: "kwp-adminNotice" }, t("enterpriseHint")),
          React.createElement("div", { className: "kwp-adminProfileForm" },
            React.createElement("label", null, React.createElement("span", null, t("enterpriseHubUrl")), React.createElement("input", { className: "kwp-adminInput", "data-enterprise-hub-url": "", value: hubUrl, placeholder: "http://192.168.1.10:3099", onChange: function (ev) { setHubUrl(ev.target.value); } })),
            React.createElement("label", null, React.createElement("span", null, t("enrollmentCode")), React.createElement("input", { className: "kwp-adminInput", "data-enterprise-code": "", value: enrollmentCode, onChange: function (ev) { setEnrollmentCode(ev.target.value); } })),
            React.createElement("label", null, React.createElement("span", null, t("terminalName")), React.createElement("input", { className: "kwp-adminInput", "data-enterprise-terminal-name": "", value: terminalName, onChange: function (ev) { setTerminalName(ev.target.value); } }))
          ),
          React.createElement("div", { className: "kwp-adminActions", style: { justifyContent: "flex-start", marginTop: "12px" } }, React.createElement("button", { type: "button", className: "kwp-adminBtn kwp-adminBtnPrimary", "data-enterprise-connect": "", disabled: busy || !hubUrl.trim(), onClick: saveEnterpriseConnection }, t("saveConnection"))),
          React.createElement("div", { className: "kwp-adminSectionTitle" }, t("enterpriseStatus")),
          React.createElement("div", { className: "kwp-adminRow" },
            React.createElement("div", { className: "kwp-adminRowMain" },
              React.createElement("div", { className: "kwp-adminRowTitle" }, enterprise.status || "未连接"),
              React.createElement("div", { className: "kwp-adminRowDesc" }, (enterprise.enterpriseName || "") + (enterprise.lastError ? " · " + enterprise.lastError : "")),
              React.createElement("div", { className: "kwp-capabilityMeta" },
                React.createElement("span", { className: "kwp-adminBadge" }, t("terminalId") + ": " + (enterprise.terminalId || "—")),
                React.createElement("span", { className: "kwp-adminBadge" }, t("lastConnectedAt") + ": " + formatTime(enterprise.lastConnectedAt))
              )
            )
          )
        );
      } else if (tab === "profile") {
        var caps = capabilitySummaryOf(worker);
        var growthItems = growthTimelineOf(worker);
        // 指标口径与 Host/中枢同源：sessionsByWorker + feedbackByWorker（非浏览器会话表）。
        var feedbackBucket = ((admin.enterprise || {}).feedbackByWorker || {})[selectedId] || null;
        var conversationCount = KaiwuUsageDisplay.conversationCountForWorker((admin.enterprise || {}).sessionsByWorker || {}, selectedId);
        var dash = KaiwuUsageDisplay.employeeDashboardMetrics(conversationCount, feedbackBucket);
        var roleLabel = worker.profile.roleName || meta.role || "";
        var isActive = worker.profile.status !== "archived";
        var activityEmpty = "当日暂无活动记录";
        body = [
          React.createElement("div", { key: "notice", className: "kwp-adminNotice", "data-profile-readonly": "" },
            "员工档案的编辑与下发已迁至企业管理端「员工档案」。本页只读展示本机档案与运行时摘要，结构对照 StaffDeck 工作记录。"
          ),
          React.createElement("div", { key: "status", className: "kwp-profileMetaRow", "data-profile-status": "" },
            React.createElement("span", { className: "kwp-adminBadge" }, isActive ? "在线" : "下线"),
            React.createElement("span", { className: "kwp-adminBadge" }, t("owner") + "：" + (worker.profile.owner || "—")),
            React.createElement("span", { className: "kwp-adminBadge" }, t("joinedAt") + "：" + (worker.profile.joinedAt || "—")),
            roleLabel ? React.createElement("span", { className: "kwp-adminBadge" }, roleLabel) : null
          ),
          React.createElement("div", { key: "metrics", className: "kwp-adminMetricGrid", "data-profile-metrics": "" },
            [
              [dash.conversationCount, t("conversationCount"), "kwp-metricClick"],
              [dash.feedbackCount, t("feedbackCount"), "kwp-metricClick"],
              [dash.positiveRate + "%", t("positiveRate"), "kwp-metricClick kwp-metricPositive"],
              [dash.negativeRate + "%", t("negativeRate"), "kwp-metricClick kwp-metricNegative"]
            ].map(function (item) {
              return React.createElement("div", { key: item[1], className: "kwp-adminMetric " + item[2] },
                React.createElement("strong", null, String(item[0])),
                React.createElement("span", null, item[1])
              );
            })
          ),
          React.createElement("div", { key: "activity", className: "kwp-profileBlock", "data-profile-activity": "" },
            React.createElement("div", { className: "kwp-profileBlockTitle" }, "活动记录"),
            React.createElement("div", { className: "kwp-adminEmpty" }, activityEmpty)
          ),
          React.createElement("div", { key: "growth", className: "kwp-profileBlock", "data-profile-growth": "" },
            React.createElement("div", { className: "kwp-profileBlockTitle" }, t("growthBlock")),
            growthItems.length
              ? React.createElement("div", { className: "kwp-growthRail" }, growthItems.map(function (item) {
                  return React.createElement("div", { key: item.id, className: "kwp-growthItem" },
                    React.createElement("span", { className: "kwp-growthDate" }, formatGrowthStamp(item.timestamp)),
                    React.createElement("span", { className: "kwp-growthDot" }),
                    React.createElement("div", { className: "kwp-growthCard" },
                      React.createElement("span", { className: "kwp-growthKind" }, item.kind),
                      React.createElement("span", { className: "kwp-growthTitle", title: item.title }, item.title)
                    )
                  );
                }))
              : React.createElement("div", { className: "kwp-adminEmpty" }, t("growthEmpty"))
          ),
          React.createElement("div", { key: "caps", className: "kwp-profileBlock", "data-profile-capabilities": "" },
            React.createElement("div", { className: "kwp-profileBlockTitle" }, t("capabilityBlock")),
            React.createElement("div", { className: "kwp-capCards" },
              [
                [t("profileCapsKnowledge"), caps.knowledgeCount, caps.knowledgeNames, "暂无知识库"],
                [t("profileCapsSkills"), caps.skillCount, caps.skillNames, "暂无启用技能"],
                [t("profileCapsSops"), caps.sopCount, caps.sopNames, "暂无启用 SOP"],
                [t("profileCapsTools"), caps.toolCount, caps.toolNames, "暂无启用工具"],
                [t("profileCapsTasks"), caps.taskCount, caps.taskNames, "暂无启用定时任务"],
                [t("profileCapsLogs"), sessionRows.length, sessionRows.slice(0, 1).map(function (row) { return row.displayTitle || row.title || row.id; }), "暂无对话任务"]
              ].map(function (card) {
                return React.createElement("div", { key: card[0], className: "kwp-capCard" },
                  React.createElement("span", { className: "kwp-capCardLabel" }, card[0]),
                  React.createElement("strong", null, String(card[1])),
                  React.createElement("span", { className: "kwp-capCardBody" }, (card[2] && card[2].length) ? card[2].slice(0, 3).join(" / ") : card[3])
                );
              })
            )
          ),
          React.createElement("div", { key: "identity", className: "kwp-profileBlock", "data-profile-identity": "" },
            React.createElement("div", { className: "kwp-profileBlockTitle" }, t("identityBlock")),
            React.createElement("div", { className: "kwp-profileGrid" },
              React.createElement("div", { className: "kwp-profileField" }, React.createElement("label", null, t("jobTitle")), React.createElement("span", null, roleLabel || "—")),
              React.createElement("div", { className: "kwp-profileField" }, React.createElement("label", null, t("department")), React.createElement("span", null, worker.profile.department || "—")),
              React.createElement("div", { className: "kwp-profileField" }, React.createElement("label", null, t("workStyles")), chipRow(worker.profile.workStyles)),
              React.createElement("div", { className: "kwp-profileField" }, React.createElement("label", null, t("expertiseTags")), chipRow(worker.profile.expertiseTags)),
              React.createElement("div", { className: "kwp-profileField" }, React.createElement("label", null, t("workModes")), chipRow(worker.profile.workModes))
            ),
            React.createElement("div", { className: "kwp-profileField" }, React.createElement("label", null, t("roleDescription")), React.createElement("span", null, worker.profile.description || t("noneYet"))),
            React.createElement("div", { className: "kwp-profileField" }, React.createElement("label", null, t("personaPrompt")), React.createElement("span", null, worker.profile.personaPrompt || t("noneYet")))
          ),
          React.createElement("div", { key: "title", className: "kwp-adminSectionTitle" }, t("recentActivity")),
          React.createElement("div", { key: "table" }, sessionTable(sessionRows, false))
        ];
      } else if (tab === "knowledge" || tab === "memories" || tab === "sops") {
        body = bodyFor(tab);
      } else if (tab === "tasks") {
        body = [React.createElement("div", { key: "notice", className: "kwp-adminNotice" }, t("taskNotice")), React.createElement("div", { key: "head", className: "kwp-adminActions", style: { justifyContent: "flex-start" } }, React.createElement("button", { type: "button", className: "kwp-adminBtn kwp-adminBtnPrimary", onClick: function () { startEdit("tasks", -1, null); } }, t("addTask"))), editorForm()].filter(Boolean);
        body = body.concat(worker.tasks.length === 0 ? [React.createElement("div", { key: "empty", className: "kwp-adminEmpty" }, t("emptyTasks"))] : worker.tasks.map(function (task, i) { return React.createElement("div", { key: i, className: "kwp-adminRow" }, React.createElement("div", { className: "kwp-adminRowMain" }, React.createElement("div", { className: "kwp-adminRowTitle" }, task.name), React.createElement("div", { className: "kwp-adminRowDesc" }, (task.schedule || "—") + " · " + (task.prompt || ""))), React.createElement("button", { className: "kwp-adminSwitch", "data-enabled": task.enabled !== false, onClick: function () { toggleTask(i); } }, task.enabled !== false ? t("enabled") : t("disabled")), React.createElement("button", { className: "kwp-adminBtn", onClick: function () { startEdit("tasks", i, task); } }, t("editDoc")), React.createElement("button", { className: "kwp-adminBtn", onClick: function () { deleteDoc("tasks", i); } }, t("deleteDoc"))); }));
      } else if (tab === "logs") {
        body = [React.createElement("div", { key: "table" }, sessionTable(sessionRows, true))];
      } else if (tab === "capabilities") {
        body = [
          React.createElement("div", { key: "notice", className: "kwp-adminNotice" }, t("abilityNotice")),
          React.createElement("section", { key: "skills", className: "kwp-capabilityGroup", "data-capability-kind": "skills" },
            React.createElement("div", { className: "kwp-capabilityHead" },
              React.createElement("div", null, React.createElement("div", { className: "kwp-capabilityTitle" }, t("skillsTitle")), React.createElement("p", { className: "kwp-adminHint" }, t("skillsReadonly"))),
              React.createElement("div", { className: "kwp-adminActions" },
                React.createElement("button", { type: "button", className: "kwp-adminBtn", onClick: openPresetDir }, t("openPresetDir")),
                React.createElement("button", { type: "button", className: "kwp-adminBtn kwp-adminBtnPrimary", onClick: function () { startEdit("skills", -1, null); } }, t("addSkill"))
              )
            ),
            editing && editing.kind === "skills" ? editorForm() : null,
            worker.skills.length === 0
              ? React.createElement("div", { className: "kwp-adminEmpty" }, t("emptySkills"))
              : worker.skills.map(function (skill, i) {
                  var sourceLabel = skill.source === "local" ? t("sourceLocal") : t("sourcePackage");
                  return React.createElement("div", { key: skill.id || i, className: "kwp-adminRow" + (skill.deleted ? " kwp-capabilityDeleted" : ""), "data-skill-id": skill.id || "" },
                    React.createElement("div", { className: "kwp-adminRowMain" },
                      React.createElement("div", { className: "kwp-adminRowTitle" }, skill.name || (workerName + " " + (i + 1))),
                      React.createElement("div", { className: "kwp-adminRowDesc" }, skill.description || ""),
                      React.createElement("div", { className: "kwp-capabilityMeta" },
                        React.createElement("span", { className: "kwp-adminBadge" }, sourceLabel),
                        skill.packageVersion ? React.createElement("span", { className: "kwp-adminBadge" }, t("version") + " " + skill.packageVersion) : null,
                        skill.modified ? React.createElement("span", { className: "kwp-adminBadge" }, t("locallyModified")) : null,
                        skill.deleted ? React.createElement("span", { className: "kwp-adminBadge" }, t("deleted")) : null
                      )
                    ),
                    skill.deleted
                      ? React.createElement("button", { type: "button", className: "kwp-adminBtn", disabled: busy, onClick: function () { restoreSkill(i); } }, t("restore"))
                      : React.createElement("button", { type: "button", className: "kwp-adminSwitch", "data-enabled": skill.enabled !== false, disabled: busy, onClick: function () { toggleSkill(i); } }, skill.enabled !== false ? t("enabled") : t("disabled")),
                    skill.deleted ? null : React.createElement("button", { type: "button", className: "kwp-adminBtn", disabled: busy, onClick: function () { startEdit("skills", i, skill); } }, t("editDoc")),
                    skill.deleted ? null : React.createElement("button", { type: "button", className: "kwp-adminBtn", disabled: busy, onClick: function () { deleteSkill(i); } }, t("deleteDoc"))
                  );
                })
          ),
          React.createElement("section", { key: "tools", className: "kwp-capabilityGroup", "data-capability-kind": "tools" },
            React.createElement("div", { className: "kwp-capabilityHead" }, React.createElement("div", { className: "kwp-capabilityTitle" }, t("toolsTitle"))),
            worker.tools.length === 0
              ? React.createElement("div", { className: "kwp-adminEmpty" }, t("emptyTools"))
              : worker.tools.map(function (tool, i) {
                  return React.createElement("div", { key: tool.id || i, className: "kwp-adminRow", "data-tool-id": tool.id || tool.name },
                    React.createElement("div", { className: "kwp-adminRowMain" },
                      React.createElement("div", { className: "kwp-adminRowTitle" }, tool.name),
                      React.createElement("div", { className: "kwp-adminRowDesc" }, tool.description),
                      React.createElement("div", { className: "kwp-capabilityMeta" }, React.createElement("span", { className: "kwp-adminBadge" }, tool.source), tool.packageVersion ? React.createElement("span", { className: "kwp-adminBadge" }, t("version") + " " + tool.packageVersion) : null, tool.modified ? React.createElement("span", { className: "kwp-adminBadge" }, t("locallyModified")) : null)
                    ),
                    React.createElement("button", { type: "button", className: "kwp-adminSwitch", "data-enabled": tool.enabled !== false, disabled: busy, onClick: function () { toggleTool(i); } }, tool.enabled !== false ? t("enabled") : t("disabled"))
                  );
                })
          )
        ];
      } else {
        body = [];
      }

      return React.createElement("div", { className: "kwp-adminRoot" },
        React.createElement("aside", { className: "kwp-adminNav" },
          rosterCache.list.map(function (p) {
            var meta = WORKER_META[p.id] || { role: "", icon: (p.name || p.id).charAt(0), gradient: "linear-gradient(135deg,#0f766e,#14b8a6)" };
            return React.createElement("button", {
              key: p.id,
              type: "button",
              className: "kwp-adminWorker",
              "data-active": p.id === selectedId,
              onClick: function () { setSelectedId(p.id); setTab("profile"); setEditing(null); }
            },
              React.createElement("span", { className: "kwp-adminWorkerAvatar", style: { background: meta.av ? "transparent" : meta.gradient } }, kwAvatar(meta)),
              React.createElement("span", { className: "kwp-adminWorkerId" },
                React.createElement("span", { className: "kwp-adminWorkerName" }, p.name || p.id),
                React.createElement("span", { className: "kwp-adminWorkerRole" }, meta.role)
              )
            );
          }),
          React.createElement("div", { className: "kwp-adminNavSection" }, t("basicInfo")),
          navButton("profile", t("tabProfile"), "▣"), navButton("tasks", t("tabTasks"), "◷"), navButton("memories", t("tabMemories"), "↶"), navButton("logs", t("tabLogs"), "▤"),
          React.createElement("div", { className: "kwp-adminNavSection" }, t("workerAbility")),
          navButton("knowledge", t("tabKnowledge"), "□"), navButton("capabilities", t("tabCapabilities"), "✧"), navButton("sops", t("tabSops"), "◇"),
          React.createElement("div", { className: "kwp-adminNavSection" }, t("enterpriseSection")),
          navButton("enterprise", t("tabEnterprise"), "◎")
        ),
        React.createElement("section", { className: "kwp-adminPanel" },
          tab === "enterprise" ? React.createElement("div", { className: "kwp-adminProfile" },
            React.createElement("div", { className: "kwp-adminProfileAvatar", style: { background: "linear-gradient(135deg,#1d4ed8,#38bdf8)" } }, "企"),
            React.createElement("div", { className: "kwp-adminProfileMain" },
              React.createElement("div", { className: "kwp-adminProfileTitle" }, React.createElement("strong", null, t("tabEnterprise"))),
              React.createElement("p", { className: "kwp-adminSummary" }, t("enterpriseHint"))
            )
          ) : React.createElement("div", { className: "kwp-adminProfile" },
            React.createElement("div", { className: "kwp-adminProfileAvatar", style: { background: meta.av ? "transparent" : meta.gradient } }, kwAvatar(meta)),
            React.createElement("div", { className: "kwp-adminProfileMain" },
              React.createElement("div", { className: "kwp-adminProfileTitle" },
                React.createElement("strong", null, workerName),
                React.createElement("span", { className: "kwp-adminProfileRole" }, worker.profile.roleName || meta.role),
                worker.profile.staffNo ? React.createElement("span", { className: "kwp-adminBadgeNo" }, worker.profile.staffNo) : null
              ),
              React.createElement("div", { className: "kwp-adminMeta" },
                React.createElement("span", { className: "kwp-adminStatus" }, t("online")),
                React.createElement("span", null, t("owner") + "：" + (worker.profile.owner || "—")),
                React.createElement("span", null, t("joinedAt") + "：" + (worker.profile.joinedAt || "—")),
                (worker.profile.workStyles || []).length
                  ? React.createElement("div", { className: "kwp-profileChips" }, (worker.profile.workStyles || []).slice(0, 3).map(function (item) {
                      return React.createElement("span", { key: item, className: "kwp-profileChip" }, item);
                    }))
                  : null
              ),
              React.createElement("p", { className: "kwp-adminSummary" }, worker.profile.summary || worker.profile.description || (rosterEntry && rosterEntry.description) || ""),
              React.createElement("div", { className: "kwp-adminCounts" },
                (function () {
                  var heroCaps = capabilitySummaryOf(worker);
                  return [
                    [heroCaps.knowledgeCount, t("profileCapsKnowledge")],
                    [heroCaps.skillCount, t("profileCapsSkills")],
                    [heroCaps.sopCount, t("profileCapsSops")],
                    [heroCaps.taskCount, t("profileCapsTasks")]
                  ].map(function (item) {
                    return React.createElement("span", { key: item[1], className: "kwp-adminCount" },
                      React.createElement("strong", null, String(item[0])),
                      item[1]
                    );
                  });
                })()
              )
            ),
            React.createElement("span", { className: "kwp-adminBadge", title: "请到企业管理端编辑档案" }, "只读")
          ),
          saveError ? React.createElement("div", { className: "kwp-adminError", role: "alert" }, saveError) : null,
          React.createElement("div", { className: "kwp-adminBody" }, body)
        )
      );
    }

