"use client";

import {
  AlertOctagon,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";

interface DispatchRecord {
  readonly id: string;
  readonly status: "DRAFT" | "CONFIRMED";
  readonly syncStatus: "NOT_QUEUED" | "PENDING";
  readonly version: number;
  readonly selection?: { readonly candidateId: string; readonly overrideReason?: string };
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
  return status === "CONFIRMED" ? "已确认" : "草稿";
}

function syncStatus(status: DispatchRecord["syncStatus"]): string {
  return status === "PENDING" ? "待同步（未发送）" : "未排队";
}

function decisionLabel(decision: CandidateEvaluation["decision"]): string {
  if (decision === "BLOCKED") return "不可选择";
  if (decision === "AVAILABLE_WITH_WARNING") return "需说明后可选";
  return "可用";
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
}: Readonly<{ selectedRoleId: string; canDispatch: boolean }>) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [payload, setPayload] = useState<DispatchPayload>();
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<"save" | "select" | "confirm" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
        readonly syncCommand: { readonly id: string };
      }>(response);
      setPayload((current) =>
        current === undefined ? current : { ...current, dispatch: result.dispatch },
      );
      setNotice(
        `派车已在本地确认；命令 ${result.syncCommand.id} 仅处于待同步状态，真实 G7 写入保持关闭。`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "派车确认失败");
    } finally {
      setBusyAction("");
    }
  }

  function resetPlanner() {
    setPayload(undefined);
    setOverrideReasons({});
    setError("");
    setNotice("");
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
          <RefreshCcw size={16} aria-hidden="true" /> 新建草稿
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
