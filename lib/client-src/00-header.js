/* client-src/00-header.js — ModuleLoader 头 + React */
// kaiwu-praxis 客户端插件（浏览器侧）：数字员工广场（覆盖主内容区、保留 DSH 原生侧边栏）。
// 自注册 bundle（classic script，非 ESM）：materialize 时返回 { name, inject, apply }。
// 侧边栏注入「数字员工广场」入口按钮，点击后在主内容区展示广场；
// 选中某位员工并开启会话后，广场自动收起，露出 DSH 原生对话界面。
window.__ModuleLoader__.load({
  id: "kaiwu-praxis",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
