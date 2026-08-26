"use client";

import {
  AlertOctagon,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Truck,
  Undo2,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";

interface DispatchRecord {
  readonly id: string;
  readonly businessNo: string;
  readonly origin: string;
  readonly destination: string;
  readonly status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  readonly syncStatus:
    | "NOT_QUEUED"
    | "PENDING"
    | "SYNCING"
    | "RETRYING"
    | "SYNCED"
    | "FAILED"
    | "REVOKED";
  readonly version: number;
  readonly selection?: { readonly candidateId: string; readonly overrideReason?: string };
}

interface SyncCommandRecord {
  readonly id: string;
  readonly status: "PENDING" | "RETRYING" | "FAILED" | "SYNCED" | "REVOKED";
  readonly attemptCount: number;
  readonly createdAt: string;
  readonly lastAttemptAt?: string;
  readonly upstreamReference?: string;
  readonly result?: "CREATED" | "ALREADY_EXISTS";
  readonly lastError?: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  };
}

interface CandidateEvaluation {
  readonly candidate: {
    readonly candidateId: string;
    readonly vehicleLabel: string;
    readonly driverLabel: string;
    readonly distanceKm: number;
    readonly qualificationsValid: boolean;
    readonly freshness: {
      readonly status: "FRESH" | "DELAYED" | "STALE" | "UNKNOWN";
      readonly source: string;
    };
  };
  readonly decision: "AVAILABLE" | "AVAILABLE_WITH_WARNING" | "BLOCKED";
  readonly blockers: readonly { readonly code: string; readonly message: string }[];
  readonly advisories: readonly { readonly code: string; readonly message: string }[];
}

interface DispatchPayload {
  readonly dispatch: DispatchRecord;
  readonly candidates: readonly CandidateEvaluation[];
  readonly syncCommand?: SyncCommandRecord;
}

interface TimelineFactRecord {
  readonly sourceEventId: string;
  readonly type: "PLAN" | "GEOFENCE" | "LOCATION" | "STATUS" | "EXCEPTION" | "RECEIPT";
  readonly source: string;
  readonly happenedAt: string;
  readonly receivedAt: string;
  readonly summary: string;
  readonly location?: string;
}

interface TimelineProjectionRecord {
  readonly events: readonly TimelineFactRecord[];
  readonly latestLocation?: TimelineFactRecord;
  readonly tripSegmentSearchUsed: boolean;
}

interface FollowUpWorkRecord {
  readonly id: string;
  readonly dispatchId: string;
  readonly vehicleId: string;
  readonly driverId: string;
  readonly sourceEventId: string;
  readonly ownerId: string;
  readonly dueAt: string;
  readonly closureCriteria: string;
  readonly title: string;
  readonly status: "OPEN";
}

export interface DispatchTodayWork {
  readonly id: string;
  readonly category: "派车" | "在途" | "异常" | "回单";
  readonly urgency: "critical" | "warning" | "normal";
  readonly due: string;
  readonly objectId: string;
  readonly route: string;
  readonly summary: string;
  readonly source: string;
  readonly freshness: string;
  readonly location: string;
  readonly owner: string;
  readonly nextAction: string;
}

const INITIAL_FORM = {
  businessNo: "YD-260825-1001",
  origin: "上海闵行集散中心",
  destination: "杭州萧山客户仓",
  plannedStart: "2026-08-25T10:30",
  plannedEnd: "2026-08-25T13:30",
  notes: "客户要求 13:30 前到仓",
};

function businessStatus(status: DispatchRecord["status"]): string {
  if (status === "CONFIRMED") return "已确认";
  if (status === "CANCELLED") return "已撤销";
  return "草稿";
}

function syncStatus(status: DispatchRecord["syncStatus"]): string {
  const labels: Record<DispatchRecord["syncStatus"], string> = {
    NOT_QUEUED: "未排队",
    PENDING: "待同步（未发送）",
    SYNCING: "同步中",
    RETRYING: "正在重试",
    SYNCED: "已同步",
    FAILED: "同步失败",
    REVOKED: "已撤销",
  };
  return labels[status];
}

function decisionLabel(decision: CandidateEvaluation["decision"]): string {
  if (decision === "BLOCKED") return "不可选择";
  if (decision === "AVAILABLE_WITH_WARNING") return "需说明后可选";
  return "可用";
}

function timelineTypeLabel(type: TimelineFactRecord["type"]): string {
  const labels: Record<TimelineFactRecord["type"], string> = {
    PLAN: "计划",
    GEOFENCE: "围栏",
    LOCATION: "位置",
    STATUS: "状态",
    EXCEPTION: "异常",
    RECEIPT: "回单",
  };
  return labels[type];
}

function localDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toUtcIso(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | { readonly message?: string };
  if (!response.ok) {
    throw new Error((body as { readonly message?: string }).message ?? "本地派车请求未完成");
  }
  return body as T;
}

export function DispatchPlanner({
  selectedRoleId,
  canDispatch,
  onTodayWorkCreated,
}: Readonly<{
  selectedRoleId: string;
  canDispatch: boolean;
  onTodayWorkCreated?: (work: DispatchTodayWork) => void;
}>) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [payload, setPayload] = useState<DispatchPayload>();
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<
    | "save"
    | "select"
    | "confirm"
    | "fail"
    | "retry"
    | "complete"
    | "revoke"
    | "timeline"
    | "work"
    | ""
  >("");
  const [timeline, setTimeline] = useState<TimelineProjectionRecord>();
  const [createdWork, setCreatedWork] = useState<FollowUpWorkRecord>();
  const [workDueAt, setWorkDueAt] = useState("2026-08-25T13:00");
  const [closureCriteria, setClosureCriteria] = useState("确认新 ETA 并通知客户");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revokeReason, setRevokeReason] = useState("本地验收撤销，不执行外部写入");
  const idempotencyKey = useRef("");

  async function saveDraft() {
    setBusyAction("save");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/dispatches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          ...form,
          plannedStart: toUtcIso(form.plannedStart),
          plannedEnd: toUtcIso(form.plannedEnd),
        }),
      });
      setPayload(await readResponse<DispatchPayload>(response));
      idempotencyKey.current = crypto.randomUUID();
      setNotice("草稿已保存；未生成或发送 G7 写入命令。请选择候选资源。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "草稿保存失败");
    } finally {
      setBusyAction("");
    }
  }

  async function selectCandidate(evaluation: CandidateEvaluation) {
    if (payload === undefined) return;
    setBusyAction("select");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/dispatches/${encodeURIComponent(payload.dispatch.id)}/selection`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            roleId: selectedRoleId,
            candidateId: evaluation.candidate.candidateId,
            overrideReason: overrideReasons[evaluation.candidate.candidateId] ?? "",
          }),
        },
      );
      setPayload(await readResponse<DispatchPayload>(response));
      setNotice("候选资源已锁定到草稿；确认前仍不会生成外部命令。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "候选选择失败");
    } finally {
      setBusyAction("");
    }
  }

  async function confirmDispatch() {
    if (payload === undefined) return;
    setBusyAction("confirm");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/dispatches/${encodeURIComponent(payload.dispatch.id)}/confirm`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey.current,
          },
          body: JSON.stringify({
            roleId: selectedRoleId,
            expectedVersion: payload.dispatch.version,
          }),
        },
      );
      const result = await readResponse<{
        readonly dispatch: DispatchRecord;
        readonly syncCommand: SyncCommandRecord;
      }>(response);
      setPayload((current) =>
        current === undefined
          ? current
          : { ...current, dispatch: result.dispatch, syncCommand: result.syncCommand },
      );
      setNotice(
        `派车已在本地确认；命令 ${result.syncCommand.id} 仅处于待同步状态，真实 G7 写入保持关闭。`,
      );
      try {
        const timelineResponse = await fetch(
          `/api/v1/dispatches/${encodeURIComponent(result.dispatch.id)}/timeline?roleId=${encodeURIComponent(selectedRoleId)}`,
          { cache: "no-store" },
        );
        setTimeline(await readResponse<TimelineProjectionRecord>(timelineResponse));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? `派车已确认，但时间线读取失败：${caught.message}`
            : "时间线读取失败",
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "派车确认失败");
    } finally {
      setBusyAction("");
    }
  }

  async function createTimelineWork(fact: TimelineFactRecord) {
    if (payload === undefined) return;
    setBusyAction("work");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/dispatches/${encodeURIComponent(payload.dispatch.id)}/timeline/work`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            roleId: selectedRoleId,
            sourceEventId: fact.sourceEventId,
            dueAt: toUtcIso(workDueAt),
            closureCriteria,
          }),
        },
      );
      const result = await readResponse<{
        readonly work: FollowUpWorkRecord;
        readonly dispatch: DispatchRecord;
        readonly sourceFact: TimelineFactRecord;
      }>(response);
      setCreatedWork(result.work);
      onTodayWorkCreated?.({
        id: result.work.id,
        category: "异常",
        urgency: "warning",
        due: `${localDateTime(result.work.dueAt)} 前`,
        objectId: result.dispatch.businessNo,
        route: `${result.dispatch.origin} → ${result.dispatch.destination}`,
        summary: result.work.title,
        source: result.sourceFact.source,
        freshness: `发生于 ${localDateTime(result.sourceFact.happenedAt)}`,
        location: result.sourceFact.location ?? "未提供文字位置",
        owner: "周贺龙",
        nextAction: "查看处置工作",
      });
      setNotice(`处置工作 ${result.work.id} 已创建并加入“今日运输”。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "处置工作创建失败");
    } finally {
      setBusyAction("");
    }
  }

  async function updateSync(
    action: "SIMULATE_RETRYABLE_FAILURE" | "RETRY" | "SIMULATE_ALREADY_EXISTS" | "REVOKE",
  ) {
    if (payload?.syncCommand === undefined) return;
    const actionName =
      action === "SIMULATE_RETRYABLE_FAILURE"
        ? "fail"
        : action === "SIMULATE_ALREADY_EXISTS"
          ? "complete"
          : action.toLowerCase();
    setBusyAction(actionName as "fail" | "retry" | "complete" | "revoke");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/dispatches/${encodeURIComponent(payload.dispatch.id)}/sync`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            roleId: selectedRoleId,
            commandId: payload.syncCommand.id,
            action,
            ...(action === "REVOKE" ? { reason: revokeReason } : {}),
          }),
        },
      );
      const result = await readResponse<{
        readonly dispatch: DispatchRecord;
        readonly syncCommand: SyncCommandRecord;
      }>(response);
      setPayload({ ...payload, dispatch: result.dispatch, syncCommand: result.syncCommand });
      const messages = {
        SIMULATE_RETRYABLE_FAILURE: "已记录暂时同步失败；本地业务仍为已确认，可重试或撤销。",
        RETRY: "原同步命令正在重试；没有创建重复命令。",
        SIMULATE_ALREADY_EXISTS: "受控回读确认绑定已存在；同步状态已收敛为已同步。",
        REVOKE: "待同步命令和本地派车已撤销；没有调用 G7。",
      } as const;
      setNotice(messages[action]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "同步恢复动作未完成");
    } finally {
      setBusyAction("");
    }
  }

  function resetPlanner() {
    setPayload(undefined);
    setTimeline(undefined);
    setCreatedWork(undefined);
    setOverrideReasons({});
    setError("");
    setNotice("");
    setRevokeReason("本地验收撤销，不执行外部写入");
    idempotencyKey.current = "";
  }

  return (
    <section className="commandSurface dispatchSurface" aria-label="派车计划">
      <div className="workspaceHeading">
        <div>
          <p>派车工作流</p>
          <h1>创建并确认运输派车</h1>
          <span>草稿 → 候选审查 → 本地确认 → 待同步；真实 G7 写入关闭</span>
        </div>
        <button className="secondaryButton" type="button" onClick={resetPlanner}>
          <RefreshCcw size={16} aria-hidden="true" /> <span>新建草稿</span>
        </button>
      </div>

      {!canDispatch ? (
        <div className="stateNotice warning" role="status">
          <ShieldCheck size={17} aria-hidden="true" />
          <div>
            <strong>当前角色为只读</strong>
            <span>切换为调度员或车队长后，服务端才会允许本地派车写操作。</span>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="stateNotice error" role="alert">
          <CircleAlert size={17} aria-hidden="true" /> <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="stateNotice neutral" role="status">
          <CheckCircle2 size={17} aria-hidden="true" /> <span>{notice}</span>
        </div>
      ) : null}

      <div className="dispatchLayout">
        <form
          className="dispatchForm"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDraft();
          }}
        >
          <SectionHeading
            step="步骤 1"
            title="运输目标与时间窗"
            value={payload ? businessStatus(payload.dispatch.status) : undefined}
          />
          <label>
            <span>业务单号</span>
            <input
              value={form.businessNo}
              onChange={(event) => setForm({ ...form, businessNo: event.target.value })}
              disabled={payload !== undefined}
              required
            />
          </label>
          <div className="fieldPair">
            <label>
              <span>起点</span>
              <input
                value={form.origin}
                onChange={(event) => setForm({ ...form, origin: event.target.value })}
                disabled={payload !== undefined}
                required
              />
            </label>
            <label>
              <span>终点</span>
              <input
                value={form.destination}
                onChange={(event) => setForm({ ...form, destination: event.target.value })}
                disabled={payload !== undefined}
                required
              />
            </label>
          </div>
          <div className="fieldPair">
            <label>
              <span>计划开始</span>
              <input
                type="datetime-local"
                value={form.plannedStart}
                onChange={(event) => setForm({ ...form, plannedStart: event.target.value })}
                disabled={payload !== undefined}
                required
              />
            </label>
            <label>
              <span>计划结束</span>
              <input
                type="datetime-local"
                value={form.plannedEnd}
                onChange={(event) => setForm({ ...form, plannedEnd: event.target.value })}
                disabled={payload !== undefined}
                required
              />
            </label>
          </div>
          <label>
            <span>调度备注</span>
            <input
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              disabled={payload !== undefined}
            />
          </label>
          <button
            className="primaryButton"
            type="submit"
            disabled={!canDispatch || payload !== undefined || busyAction !== ""}
          >
            <Save size={17} aria-hidden="true" /> {busyAction === "save" ? "正在保存" : "保存草稿"}
          </button>
          <p className="formFootnote">保存草稿不会创建 G7 写命令。</p>
        </form>

        <section className="dispatchProgress" aria-label="派车状态">
          <SectionHeading step="执行边界" title="状态与同步" />
          <dl className="dispatchFacts">
            <div>
              <dt>业务状态</dt>
              <dd>{payload ? businessStatus(payload.dispatch.status) : "尚未创建"}</dd>
            </div>
            <div>
              <dt>G7 同步状态</dt>
              <dd>{payload ? syncStatus(payload.dispatch.syncStatus) : "不适用"}</dd>
            </div>
            <div>
              <dt>并发版本</dt>
              <dd className="mono">{payload?.dispatch.version ?? "-"}</dd>
            </div>
            <div>
              <dt>生产写入</dt>
              <dd>关闭</dd>
            </div>
          </dl>
          <div className="boundaryNote">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>业务确认不会被外部同步失败回滚为草稿；同步状态单独记录并可恢复。</p>
          </div>
        </section>
      </div>

      {payload ? (
        <section className="candidateSection">
          <SectionHeading
            step="步骤 2"
            title="审查车辆与司机候选"
            value={`${payload.candidates.length} 组候选`}
          />
          <div className="candidateGrid">
            {payload.candidates.map((evaluation) => {
              const selected =
                payload.dispatch.selection?.candidateId === evaluation.candidate.candidateId;
              return (
                <article
                  className={`candidateItem ${evaluation.decision.toLowerCase()}${selected ? " selected" : ""}`}
                  key={evaluation.candidate.candidateId}
                >
                  <div className="candidateTitle">
                    <div>
                      <Truck size={18} aria-hidden="true" />
                      <span>
                        <strong className="mono">{evaluation.candidate.vehicleLabel}</strong>
                        <small>
                          <UserRound size={13} aria-hidden="true" />{" "}
                          {evaluation.candidate.driverLabel}
                        </small>
                      </span>
                    </div>
                    <span className="decisionTag">{decisionLabel(evaluation.decision)}</span>
                  </div>
                  <dl className="candidateFacts">
                    <div>
                      <dt>
                        <MapPin size={14} aria-hidden="true" /> 距起点
                      </dt>
                      <dd>{evaluation.candidate.distanceKm} km</dd>
                    </div>
                    <div>
                      <dt>
                        <Clock3 size={14} aria-hidden="true" /> 新鲜度
                      </dt>
                      <dd>{evaluation.candidate.freshness.status}</dd>
                    </div>
                    <div>
                      <dt>资格</dt>
                      <dd>{evaluation.candidate.qualificationsValid ? "有效" : "不通过"}</dd>
                    </div>
                    <div>
                      <dt>来源</dt>
                      <dd>合成 SANDBOX fixture</dd>
                    </div>
                  </dl>
                  <FindingList kind="blocker" findings={evaluation.blockers} />
                  <FindingList kind="advice" findings={evaluation.advisories} />
                  {evaluation.decision === "AVAILABLE_WITH_WARNING" && !selected ? (
                    <label className="overrideField">
                      <span>覆盖理由（必填）</span>
                      <textarea
                        value={overrideReasons[evaluation.candidate.candidateId] ?? ""}
                        onChange={(event) =>
                          setOverrideReasons({
                            ...overrideReasons,
                            [evaluation.candidate.candidateId]: event.target.value,
                          })
                        }
                        placeholder="说明为何接受该建议项"
                        rows={2}
                      />
                    </label>
                  ) : null}
                  <button
                    className={selected ? "secondaryButton" : "primaryButton"}
                    type="button"
                    disabled={
                      !canDispatch ||
                      evaluation.decision === "BLOCKED" ||
                      payload.dispatch.status === "CONFIRMED" ||
                      busyAction !== "" ||
                      selected
                    }
                    onClick={() => void selectCandidate(evaluation)}
                  >
                    {selected ? (
                      <CheckCircle2 size={17} aria-hidden="true" />
                    ) : (
                      <Truck size={17} aria-hidden="true" />
                    )}
                    {selected ? "已选择" : "选择此组合"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {payload?.dispatch.selection ? (
        <section className="confirmBand">
          <div>
            <span>步骤 3</span>
            <h2>
              {payload.dispatch.status === "CONFIRMED"
                ? "本地派车已确认"
                : "确认派车并生成待同步命令"}
            </h2>
            <p>确认接口具备幂等保护，不会重复创建命令。</p>
          </div>
          <button
            className="primaryButton"
            type="button"
            disabled={!canDispatch || payload.dispatch.status === "CONFIRMED" || busyAction !== ""}
            onClick={() => void confirmDispatch()}
          >
            <Send size={17} aria-hidden="true" />{" "}
            {payload.dispatch.status === "CONFIRMED"
              ? "已确认"
              : busyAction === "confirm"
                ? "正在确认"
                : "确认本地派车"}
          </button>
        </section>
      ) : null}

      {timeline ? (
        <section className="dispatchTimelineSection" aria-label="在途时间线">
          <div className="syncRecoveryHeading">
            <div>
              <span>步骤 4</span>
              <h2>在途事实与处置工作</h2>
              <p>按发生时间排序；来源和接收时间独立保留。</p>
            </div>
            <strong className="statusTag">
              trip-segment-search {timeline.tripSegmentSearchUsed ? "已启用" : "已关闭"}
            </strong>
          </div>
          <ol className="dispatchTimelineList">
            {timeline.events.map((fact) => {
              const linkedWork = createdWork?.sourceEventId === fact.sourceEventId;
              return (
                <li
                  className={fact.type === "EXCEPTION" ? "exception" : ""}
                  key={fact.sourceEventId}
                >
                  <div className="timelineFactHeading">
                    <span>{timelineTypeLabel(fact.type)}</span>
                    <time dateTime={fact.happenedAt}>{localDateTime(fact.happenedAt)}</time>
                  </div>
                  <strong>{fact.summary}</strong>
                  <p>{fact.location ?? "无位置字段"}</p>
                  <small>
                    {fact.source} · 接收于 {localDateTime(fact.receivedAt)}
                  </small>
                  {fact.type === "EXCEPTION" ? (
                    linkedWork ? (
                      <dl className="linkedWorkFacts">
                        <div>
                          <dt>今日工作</dt>
                          <dd className="mono">{createdWork.id}</dd>
                        </div>
                        <div>
                          <dt>责任</dt>
                          <dd>周贺龙</dd>
                        </div>
                        <div>
                          <dt>时限</dt>
                          <dd>{localDateTime(createdWork.dueAt)}</dd>
                        </div>
                        <div>
                          <dt>关闭条件</dt>
                          <dd>{createdWork.closureCriteria}</dd>
                        </div>
                      </dl>
                    ) : (
                      <div className="timelineWorkComposer">
                        <label>
                          <span>责任人</span>
                          <input value="周贺龙（当前登录人）" disabled />
                        </label>
                        <label>
                          <span>完成时限</span>
                          <input
                            type="datetime-local"
                            value={workDueAt}
                            onChange={(event) => setWorkDueAt(event.target.value)}
                          />
                        </label>
                        <label className="closureField">
                          <span>关闭条件</span>
                          <input
                            value={closureCriteria}
                            onChange={(event) => setClosureCriteria(event.target.value)}
                          />
                        </label>
                        <button
                          className="primaryButton"
                          type="button"
                          disabled={
                            !canDispatch || busyAction !== "" || closureCriteria.trim().length === 0
                          }
                          onClick={() => void createTimelineWork(fact)}
                        >
                          <BriefcaseBusiness size={17} aria-hidden="true" />
                          {busyAction === "work" ? "正在创建" : "创建处置工作"}
                        </button>
                      </div>
                    )
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {payload?.syncCommand ? (
        <section className={`syncRecoveryPanel ${payload.syncCommand.status.toLowerCase()}`}>
          <div className="syncRecoveryHeading">
            <div>
              <span>同步恢复</span>
              <h2>{syncStatus(payload.dispatch.syncStatus)}</h2>
              <p>本地业务保持“{businessStatus(payload.dispatch.status)}”，同步状态独立推进。</p>
            </div>
            <strong className="statusTag">尝试 {payload.syncCommand.attemptCount} 次</strong>
          </div>
          <dl className="syncRecoveryFacts">
            <div>
              <dt>命令</dt>
              <dd className="mono">{payload.syncCommand.id}</dd>
            </div>
            <div>
              <dt>最后尝试</dt>
              <dd>{payload.syncCommand.lastAttemptAt ?? "尚未发送"}</dd>
            </div>
            <div>
              <dt>{payload.syncCommand.status === "SYNCED" ? "回读结果" : "当前影响"}</dt>
              <dd>
                {payload.syncCommand.status === "SYNCED"
                  ? "绑定已受控回读确认；本地派车保持已确认"
                  : "G7 人车绑定尚未确认；本地派车不回滚"}
              </dd>
            </div>
            {payload.syncCommand.lastError ? (
              <div>
                <dt>{payload.syncCommand.status === "SYNCED" ? "上次失败" : "失败原因"}</dt>
                <dd>{payload.syncCommand.lastError.message}</dd>
              </div>
            ) : null}
            {payload.syncCommand.upstreamReference ? (
              <div>
                <dt>上游引用</dt>
                <dd className="mono">{payload.syncCommand.upstreamReference}</dd>
              </div>
            ) : null}
          </dl>
          <div className="syncRecoveryActions">
            {payload.syncCommand.status === "PENDING" ? (
              <button
                className="secondaryButton"
                type="button"
                disabled={busyAction !== ""}
                onClick={() => void updateSync("SIMULATE_RETRYABLE_FAILURE")}
              >
                <CircleAlert size={17} aria-hidden="true" /> 演练暂时失败
              </button>
            ) : null}
            {payload.syncCommand.status === "FAILED" ? (
              <>
                <button
                  className="primaryButton"
                  type="button"
                  disabled={busyAction !== "" || !payload.syncCommand.lastError?.retryable}
                  onClick={() => void updateSync("RETRY")}
                >
                  <RotateCcw size={17} aria-hidden="true" /> 重试原命令
                </button>
                <label className="revokeField">
                  <span>撤销原因</span>
                  <input
                    value={revokeReason}
                    onChange={(event) => setRevokeReason(event.target.value)}
                  />
                </label>
                <button
                  className="secondaryButton dangerButton"
                  type="button"
                  disabled={busyAction !== "" || revokeReason.trim().length === 0}
                  onClick={() => void updateSync("REVOKE")}
                >
                  <Undo2 size={17} aria-hidden="true" /> 撤销本地派车
                </button>
              </>
            ) : null}
            {payload.syncCommand.status === "RETRYING" ? (
              <button
                className="primaryButton"
                type="button"
                disabled={busyAction !== ""}
                onClick={() => void updateSync("SIMULATE_ALREADY_EXISTS")}
              >
                <CheckCircle2 size={17} aria-hidden="true" /> 完成受控回读
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function SectionHeading({
  step,
  title,
  value,
}: Readonly<{ step: string; title: string; value?: string }>) {
  return (
    <div className="sectionHeading">
      <div>
        <span>{step}</span>
        <h2>{title}</h2>
      </div>
      {value ? <strong className="statusTag">{value}</strong> : null}
    </div>
  );
}

function FindingList({
  kind,
  findings,
}: Readonly<{ kind: "blocker" | "advice"; findings: CandidateEvaluation["blockers"] }>) {
  if (findings.length === 0) return null;
  const Icon = kind === "blocker" ? AlertOctagon : CircleAlert;
  return (
    <ul
      className={`findingList ${kind}List`}
      aria-label={kind === "blocker" ? "阻断原因" : "建议事项"}
    >
      {findings.map((finding) => (
        <li key={finding.code}>
          <Icon size={14} aria-hidden="true" /> {finding.message}
        </li>
      ))}
    </ul>
  );
}
