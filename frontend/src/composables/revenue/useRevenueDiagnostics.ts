/**
 * 收益填报页·诊断与渲染追踪 composable
 *
 * 负责页面渲染耗时追踪、提交刷新决策日志等诊断埋点，不参与业务状态判断。
 * 原 mixin: diagnostics.mixin.js
 */
import type { RevenueFillState } from "@/types/revenue";

let pageRenderTraceSeq = 0;
let submitRefreshTraceSeq = 0;

interface PageRenderTrace {
  id: number;
  startedAt: number;
  startedWallAt: number;
}

interface SubmitRefreshTrace {
  id: number;
  action: string;
  startedAt: number;
  startedWallAt: number;
}

export function useRevenueDiagnostics(state: RevenueFillState) {
  function getPageTraceNow(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }

  function formatPageTraceTime(value: number): string {
    const date = new Date(value);
    const pad = (num: number, size = 2) => String(num).padStart(size, "0");
    return [
      date.getFullYear(),
      "-",
      pad(date.getMonth() + 1),
      "-",
      pad(date.getDate()),
      " ",
      pad(date.getHours()),
      ":",
      pad(date.getMinutes()),
      ":",
      pad(date.getSeconds()),
      ".",
      pad(date.getMilliseconds(), 3),
    ].join("");
  }

  function createPageRenderTrace(): PageRenderTrace {
    const startedAt = getPageTraceNow();
    const startedWallAt = Date.now();
    return {
      id: ++pageRenderTraceSeq,
      startedAt,
      startedWallAt,
    };
  }

  function waitForPageRenderedFrame(): Promise<void> {
    return new Promise((resolve) => {
      // 使用 queueMicrotask 替代 nextTick（在 composable 中不依赖组件实例）
      queueMicrotask(() => {
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
          });
          return;
        }
        const timer =
          typeof window !== "undefined" && typeof window.setTimeout === "function"
            ? window.setTimeout
            : setTimeout;
        timer(resolve, 0);
      });
    });
  }

  function buildPageRenderSummary() {
    const detail = state.detail as Record<string, unknown>;
    const rows = Array.isArray(detail.rows) ? detail.rows : [];
    const dimensions =
      (state.dimensions?.years?.length
        ? state.dimensions
        : (detail.dimensions as { years?: string[] })) || { years: [] };
    const years = Array.isArray(dimensions?.years) ? dimensions.years : [];
    const trims =
      Array.isArray(state.trimOptions) && state.trimOptions.length
        ? state.trimOptions
        : Array.isArray(detail.trimOptions)
          ? (detail.trimOptions as unknown[])
          : [];
    const formulaDetail = state.formulaSourceDetail as Record<string, unknown> | null;
    return {
      projectId: state.queryProjectId || "-",
      stage: state.currentStageCode || state.queryStage || "-",
      rowCount: rows.length,
      yearCount: years.length,
      trimCount: trims.length,
      formulaSourceRowCount:
        formulaDetail && Array.isArray(formulaDetail.rows)
          ? formulaDetail.rows.length
          : 0,
    };
  }

  async function logPageRenderTiming(
    trace: PageRenderTrace,
    dataReadyAt: number,
    dataReadyWallAt: number,
    summary: Record<string, unknown>,
  ) {
    await waitForPageRenderedFrame();
    const renderedAt = getPageTraceNow();
    const renderedWallAt = Date.now();
     
    console.groupCollapsed(
      `[收益页面渲染][#${trace.id}] 渲染完成 ${formatPageTraceTime(renderedWallAt)} ` +
        `数据到渲染 ${Math.round(renderedAt - dataReadyAt)}ms`,
    );
     
    console.log("页面", "/revenue/subtable-fill-detail");
     
    console.log("开始加载时间", formatPageTraceTime(trace.startedWallAt));
     
    console.log("数据准备完成时间", formatPageTraceTime(dataReadyWallAt));
     
    console.log("渲染完成时间", formatPageTraceTime(renderedWallAt));
     
    console.log("数据到渲染耗时(ms)", Math.round(renderedAt - dataReadyAt));
     
    console.log("加载到渲染总耗时(ms)", Math.round(renderedAt - trace.startedAt));
     
    console.log("页面数据摘要", summary);
     
    console.groupEnd();
  }

  function createSubmitRefreshTrace(action: string): SubmitRefreshTrace {
    return {
      id: ++submitRefreshTraceSeq,
      action,
      startedAt: getPageTraceNow(),
      startedWallAt: Date.now(),
    };
  }

  function logSubmitRefreshDecision(
    trace: SubmitRefreshTrace,
    decision: string,
    detail: Record<string, unknown> = {},
  ) {
     
    console.groupCollapsed(
      `[收益提交刷新][#${trace.id}] ${decision} ${formatPageTraceTime(Date.now())}`,
    );
     
    console.log("操作", trace.action || "-");
     
    console.log("是否调用 loadPage", detail.fullReload ? "是" : "否");
     
    console.log("原因", detail.reason || "-");
     
    console.log("跳过的接口", detail.skippedApis || []);
     
    console.log("本地更新", detail.localState || {});
     
    console.log("提交返回", detail.result || {});
     
    console.groupEnd();
  }

  async function logSubmitLocalRenderTiming(
    trace: SubmitRefreshTrace,
    detail: Record<string, unknown> = {},
  ) {
    await waitForPageRenderedFrame();
    const renderedAt = getPageTraceNow();
    const renderedWallAt = Date.now();
     
    console.groupCollapsed(
      `[收益提交刷新][#${trace.id}] 局部渲染完成 ${formatPageTraceTime(renderedWallAt)} ` +
        `提交返回到渲染 ${Math.round(renderedAt - trace.startedAt)}ms`,
    );
     
    console.log("操作", trace.action || "-");
     
    console.log("提交返回处理开始时间", formatPageTraceTime(trace.startedWallAt));
     
    console.log("局部渲染完成时间", formatPageTraceTime(renderedWallAt));
     
    console.log("提交返回到渲染耗时(ms)", Math.round(renderedAt - trace.startedAt));
     
    console.log("页面数据摘要", {
      ...buildPageRenderSummary(),
      ...detail,
    });
     
    console.groupEnd();
  }

  return {
    getPageTraceNow,
    formatPageTraceTime,
    createPageRenderTrace,
    waitForPageRenderedFrame,
    buildPageRenderSummary,
    logPageRenderTiming,
    createSubmitRefreshTrace,
    logSubmitRefreshDecision,
    logSubmitLocalRenderTiming,
  };
}
