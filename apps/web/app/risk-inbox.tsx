"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  History,
  RefreshCcw,
  ShieldAlert,
  TimerReset,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";

type SafetyEventType = "SPEEDING" | "HARSH_ACCELERATION" | "HARSH_BRAKING" | "FATIGUE_DRIVING";

interface SafetyInboxEvent {
  readonly id: string;
  readonly sourceEventId: string;
  readonly eventType: SafetyEventType;
  readonly vehicleId: string;
  readonly driverId?: string;
  readonly happenedAt: string;
  readonly receivedAt: string;
  readonly summary: string;
  readonly source: string;
  readonly revisionCount: number;
}

interface SafetyInboxResponse {
  readonly mode: "LOCAL_SYNTHETIC";
  readonly events: readonly SafetyInboxEvent[];
  readonly partition: {
    readonly status: "ACTIVE" | "PAUSED_CURSOR_GAP" | "THROTTLED";
    readonly cursor?: string;
    readonly gap?: {
      readonly status: "OPEN" | "RECOVERED";
      readonly start: string;
      readonly end: string;
      readonly recoveredAt?: string;
      readonly recoveredRecords?: number;
    };
  };
  readonly metrics: {
    readonly acceptedRecords: number;
    readonly duplicateRecords: number;
    readonly cursorGapsDetected: number;
    readonly cursorGapsRecovered: number;
    readonly rateLimitEvents: number;
  };
  readonly auditEvents: readonly {
    readonly id: string;
    readonly action: "CURSOR_GAP_DETECTED" | "CURSOR_GAP_RECOVERED" | "RATE_LIMITED";
    readonly occurredAt: string;
    readonly detail: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }[];
  readonly requestId: string;
}

function localTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function eventLabel(type: SafetyEventType): string {
  if (type === "SPEEDING") return "超速";
  if (type === "HARSH_ACCELERATION") return "急加速";
  if (type === "HARSH_BRAKING") return "急减速";
  return "疲劳驾驶";
}

function eventRisk(type: SafetyEventType): "critical" | "warning" {
  return type === "FATIGUE_DRIVING" || type === "SPEEDING" ? "critical" : "warning";
}

export function RiskInbox({ selectedRoleId }: Readonly<{ selectedRoleId: string }>) {
  const [data, setData] = useState<SafetyInboxResponse>();
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      roleId: selectedRoleId,
      refresh: String(refreshKey),
    });
    void fetch(`/api/v1/safety/events?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as SafetyInboxResponse & { message?: string };
        if (!response.ok) throw new Error(body.message ?? "风险事件读取失败");
        setData(body);
        setSelectedId((current) =>
          body.events.some((event) => event.id === current) ? current : (body.events[0]?.id ?? ""),
        );
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError(caught instanceof Error ? caught.message : "风险事件读取失败");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey, selectedRoleId]);

  const selected = data?.events.find((event) => event.id === selectedId) ?? data?.events[0];

  return (
    <section className="riskInbox" aria-label="风险收件箱">
      <header className="riskInboxHeading">
        <div>
          <p>安全运营 · 本地合成 Feed</p>
          <h1>风险收件箱</h1>
          <span>来源事实只读 · 处置写入关闭</span>
        </div>
        <button
          className="secondaryButton"
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading}
        >
          <RefreshCcw size={16} aria-hidden="true" />
          刷新
        </button>
      </header>

      <div className="stateNotice warning" role="status">
        <WifiOff size={17} aria-hidden="true" />
        <div>
          <strong>G7 安全 Feed 尚未连接</strong>
          <span>当前展示重复、乱序、游标失效和历史回补的本地合成验证结果。</span>
        </div>
      </div>

      {error ? (
        <div className="stateNotice error" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading && data === undefined ? (
        <div className="riskInboxLoading" role="status">
          正在读取风险事件…
        </div>
      ) : null}

      {data !== undefined ? (
        <>
          <section className="feedMetrics" aria-label="Feed 可靠性指标">
            <div>
              <Activity size={17} aria-hidden="true" />
              <span>已接收</span>
              <strong>{data.metrics.acceptedRecords}</strong>
            </div>
            <div>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>重复已忽略</span>
              <strong>{data.metrics.duplicateRecords}</strong>
            </div>
            <div>
              <TimerReset size={17} aria-hidden="true" />
              <span>缺口已恢复</span>
              <strong>{data.metrics.cursorGapsRecovered}</strong>
            </div>
            <div>
              <Gauge size={17} aria-hidden="true" />
              <span>当前分区</span>
              <strong>{data.partition.status === "ACTIVE" ? "正常" : "降级"}</strong>
            </div>
          </section>

          <div className="riskInboxLayout">
            <section className="riskEventQueue" aria-label="安全事件列表">
              <div className="riskQueueHeader" aria-hidden="true">
                <span>风险 / 时间</span>
                <span>车辆与司机</span>
                <span>事件事实</span>
                <span>版本</span>
              </div>
              <ul>
                {data.events.map((event) => {
                  const risk = eventRisk(event.eventType);
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        className={`riskEventRow ${risk}${event.id === selected?.id ? " selected" : ""}`}
                        onClick={() => setSelectedId(event.id)}
                        aria-current={event.id === selected?.id ? "true" : undefined}
                      >
                        <span className="riskType">
                          <ShieldAlert size={17} aria-hidden="true" />
                          <span>
                            <strong>{eventLabel(event.eventType)}</strong>
                            <small>{localTime(event.happenedAt)}</small>
                          </span>
                        </span>
                        <span>
                          <strong className="mono">{event.vehicleId}</strong>
                          <small>{event.driverId ?? "司机未知"}</small>
                        </span>
                        <span>
                          <strong>{event.summary}</strong>
                          <small>接收 {localTime(event.receivedAt)} · 本地合成</small>
                        </span>
                        <span className="revisionCount">{event.revisionCount} 版</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside className="feedIntegrity" aria-label="Feed 完整性">
              <div className="feedIntegrityHeading">
                <div>
                  <span>Feed 完整性</span>
                  <strong>{data.partition.status === "ACTIVE" ? "分区正常" : "分区降级"}</strong>
                </div>
                <CheckCircle2 size={20} aria-hidden="true" />
              </div>
              <dl>
                <div>
                  <dt>已提交游标</dt>
                  <dd className="mono">{data.partition.cursor ?? "尚未建立"}</dd>
                </div>
                <div>
                  <dt>事件标识</dt>
                  <dd className="mono">{selected?.sourceEventId ?? "未选择"}</dd>
                </div>
                <div>
                  <dt>来源与版本</dt>
                  <dd>
                    {selected === undefined
                      ? "未选择"
                      : `${selected.source} · ${selected.revisionCount} 版`}
                  </dd>
                </div>
                <div>
                  <dt>请求 ID</dt>
                  <dd className="mono">{data.requestId}</dd>
                </div>
              </dl>
              <div className="feedAudit">
                <h2>
                  <History size={16} aria-hidden="true" /> 缺口审计
                </h2>
                <ol>
                  {data.auditEvents
                    .filter((event) => event.action !== "RATE_LIMITED")
                    .map((event) => (
                      <li key={event.id}>
                        <span>{localTime(event.occurredAt)}</span>
                        <strong>
                          {event.action === "CURSOR_GAP_DETECTED"
                            ? "游标缺口已记录"
                            : "历史回补已完成"}
                        </strong>
                        <small>{event.detail}</small>
                      </li>
                    ))}
                </ol>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </section>
  );
}
