"use client";

import {
  Bell,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Clock3,
  FileCheck2,
  List,
  ListFilter,
  Map as MapIcon,
  MapPinned,
  Navigation,
  PackageCheck,
  PanelRightClose,
  Phone,
  Radio,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Truck,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DispatchPlanner, type DispatchTodayWork } from "./dispatch-planner.tsx";
import { RiskInbox } from "./risk-inbox.tsx";

type WorkView = "list" | "timeline" | "map";
type ContextTab = "now" | "timeline" | "record" | "audit";
type WorkModule = "today" | "dispatch" | "exceptions";

interface RoleOption {
  readonly id: string;
  readonly label: string;
  readonly workspace: string;
  readonly canDispatch: boolean;
}

interface WorkbenchSession {
  readonly displayName: string;
  readonly tenantLabel: string;
  readonly tenantId: string;
  readonly selectedRoleId: string;
  readonly roleOptions: readonly RoleOption[];
  readonly requestId: string;
  readonly traceId: string;
}

type WorkItem = DispatchTodayWork;

interface LocalTodayWorkProjection {
  readonly id: string;
  readonly category: "异常";
  readonly urgency: "warning";
  readonly dueAt: string;
  readonly objectId: string;
  readonly route: string;
  readonly summary: string;
  readonly source: string;
  readonly happenedAt: string;
  readonly location: string;
  readonly owner: string;
  readonly nextAction: "查看处置工作";
}

const WORK_ITEMS: readonly WorkItem[] = Object.freeze([
  {
    id: "work-001",
    category: "异常",
    urgency: "critical",
    due: "已超时 18 分钟",
    objectId: "沪A·2F18",
    route: "上海嘉定 → 苏州相城",
    summary: "预计晚到 42 分钟，客户时窗将在 10:40 关闭",
    source: "本地合成事实",
    freshness: "位置 3 分钟前",
    location: "G2 京沪高速 · 昆山花桥附近",
    owner: "待接手",
    nextAction: "接手晚到异常",
  },
  {
    id: "work-002",
    category: "派车",
    urgency: "warning",
    due: "10:15 前",
    objectId: "YD-260825-0831",
    route: "上海闵行 → 杭州萧山",
    summary: "司机工时校验待确认，车辆已锁定 08:24",
    source: "本地合成事实",
    freshness: "排程 6 分钟前",
    location: "上海闵行集散中心 3 号月台",
    owner: "周贺龙",
    nextAction: "核对人车资格",
  },
  {
    id: "work-003",
    category: "在途",
    urgency: "normal",
    due: "11:30 到达",
    objectId: "苏E·8M52",
    route: "苏州吴中 → 上海浦东",
    summary: "运输正常，下一节点为浦东签收站",
    source: "本地合成事实",
    freshness: "位置 2 分钟前",
    location: "S26 沪常高速 · 青浦段",
    owner: "系统跟踪",
    nextAction: "核对预计到达",
  },
  {
    id: "work-004",
    category: "回单",
    urgency: "warning",
    due: "今日 12:00",
    objectId: "POD-260824-117",
    route: "嘉兴南湖 → 上海松江",
    summary: "签收图片已到达，缺少收货方签名页",
    source: "本地合成事实",
    freshness: "回单 21 分钟前",
    location: "上海松江客户仓",
    owner: "待补件",
    nextAction: "发起回单补件",
  },
  {
    id: "work-005",
    category: "异常",
    urgency: "warning",
    due: "11:05 前",
    objectId: "浙A·7K91",
    route: "杭州余杭 → 湖州德清",
    summary: "位置事实延迟，最后有效速度为 68 km/h",
    source: "本地合成事实",
    freshness: "位置 18 分钟前",
    location: "G25 长深高速 · 仁和段（最后位置）",
    owner: "待核实",
    nextAction: "联系司机核实位置",
  },
]);

const NAV_ITEMS = [
  { id: "today", label: "今日运输", icon: PackageCheck, count: 12, enabled: true },
  { id: "orders", label: "订单", icon: Boxes, count: 7, enabled: false },
  { id: "dispatch", label: "派车", icon: Truck, count: 4, enabled: true },
  { id: "transit", label: "在途", icon: MapPinned, count: 23, enabled: false },
  { id: "exceptions", label: "异常", icon: TriangleAlert, count: 4, enabled: true },
  { id: "receipts", label: "回单", icon: FileCheck2, count: 5, enabled: false },
  { id: "settlement", label: "结算", icon: ReceiptText, count: 2, enabled: false },
] as const;

const CONTEXT_TABS: readonly { id: ContextTab; label: string }[] = [
  { id: "now", label: "现在" },
  { id: "timeline", label: "时间线" },
  { id: "record", label: "档案" },
  { id: "audit", label: "审计" },
];

function urgencyLabel(urgency: WorkItem["urgency"]): string {
  if (urgency === "critical") return "立即处理";
  if (urgency === "warning") return "需要关注";
  return "状态正常";
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

export function Workbench({ session }: Readonly<{ session: WorkbenchSession }>) {
  const [selectedId, setSelectedId] = useState(WORK_ITEMS[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<WorkView>("list");
  const [contextTab, setContextTab] = useState<ContextTab>("now");
  const [selectedRoleId, setSelectedRoleId] = useState(session.selectedRoleId);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [acceptedIds, setAcceptedIds] = useState<ReadonlySet<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeModule, setActiveModule] = useState<WorkModule>("today");
  const [createdWorkItems, setCreatedWorkItems] = useState<readonly WorkItem[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      roleId: selectedRoleId,
      windowStart: "2026-08-25T00:00:00.000Z",
      windowEnd: "2026-08-26T00:00:00.000Z",
    });
    void fetch(`/api/v1/work-items?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          readonly items?: readonly LocalTodayWorkProjection[];
        };
        if (!response.ok || body.items === undefined) return;
        setCreatedWorkItems(
          body.items.map((item) => ({
            id: item.id,
            category: item.category,
            urgency: item.urgency,
            due: `${localDateTime(item.dueAt)} 前`,
            objectId: item.objectId,
            route: item.route,
            summary: item.summary,
            source: item.source,
            freshness: `发生于 ${localDateTime(item.happenedAt)}`,
            location: item.location,
            owner: item.owner,
            nextAction: item.nextAction,
          })),
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRoleError("今日工作投影读取失败，请刷新重试");
        }
      });
    return () => controller.abort();
  }, [selectedRoleId]);

  const filteredItems = useMemo(() => {
    const allItems = [...createdWorkItems, ...WORK_ITEMS];
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (normalized.length === 0) return allItems;
    return allItems.filter((item) =>
      [item.objectId, item.route, item.summary, item.category, item.location].some((value) =>
        value.toLocaleLowerCase("zh-CN").includes(normalized),
      ),
    );
  }, [createdWorkItems, query]);

  const selectedItem =
    [...createdWorkItems, ...WORK_ITEMS].find((item) => item.id === selectedId) ??
    filteredItems[0] ??
    WORK_ITEMS[0];
  const selectedRole = session.roleOptions.find((role) => role.id === selectedRoleId);

  async function changeRole(nextRoleId: string) {
    setRoleBusy(true);
    setRoleError("");
    try {
      const response = await fetch("/api/session/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId: nextRoleId, tenant_id: "ignored-browser-value" }),
      });
      const result = (await response.json()) as { selectedRoleId?: string; message?: string };
      if (!response.ok || result.selectedRoleId === undefined) {
        throw new Error(result.message ?? "角色切换未通过服务端校验");
      }
      setSelectedRoleId(result.selectedRoleId);
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : "角色切换未通过服务端校验");
    } finally {
      setRoleBusy(false);
    }
  }

  function acceptSelectedWork() {
    if (selectedItem === undefined) return;
    setAcceptedIds((current) => new Set([...current, selectedItem.id]));
  }

  return (
    <main className="appShell">
      <aside className="lifecycleRail" aria-label="运输生命周期">
        <div className="brandBlock">
          <span className="brandMark" aria-hidden="true">
            易
          </span>
          <div>
            <strong>易行物流</strong>
            <span>智能工作台</span>
          </div>
        </div>
        <nav className="lifecycleNav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeModule;
            const itemCount =
              item.id === "today" ? item.count + createdWorkItems.length : item.count;
            return (
              <button
                className={`navItem${active ? " active" : ""}`}
                type="button"
                key={item.label}
                aria-current={active ? "page" : undefined}
                aria-label={`${item.label}\uFF0C${itemCount} \u9879\u5F85\u5904\u7406`}
                title={item.enabled ? item.label : `${item.label}将在后续批次启用`}
                disabled={!item.enabled}
                onClick={() => {
                  if (item.id === "today" || item.id === "dispatch" || item.id === "exceptions") {
                    setActiveModule(item.id);
                  }
                }}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span className="navLabel">{item.label}</span>
                <span className="navCount" title={`${itemCount} 项待处理`}>
                  {itemCount}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="railStatus">
          <ShieldCheck size={16} aria-hidden="true" />
          <div>
            <strong>本地开发边界</strong>
            <span>真实写入已关闭</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="searchBox">
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索车牌、订单、任务或位置"
              aria-label="全局搜索"
            />
            {query.length > 0 ? (
              <button
                className="iconButton compact"
                type="button"
                onClick={() => setQuery("")}
                aria-label="清除搜索"
                title="清除搜索"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : (
              <kbd>Ctrl K</kbd>
            )}
          </div>
          <div className="topbarActions">
            <span className="environmentBadge">
              <CircleDot size={14} aria-hidden="true" /> 本地合成数据
            </span>
            <button className="iconButton" type="button" aria-label="打开通知" title="通知">
              <Bell size={18} aria-hidden="true" />
              <span className="notificationDot" />
            </button>
            <label className="roleControl">
              <UserRound size={17} aria-hidden="true" />
              <span className="srOnly">切换角色</span>
              <select
                value={selectedRoleId}
                disabled={roleBusy}
                onChange={(event) => void changeRole(event.target.value)}
                aria-label="当前角色"
              >
                {session.roleOptions.map((role) => (
                  <option value={role.id} key={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="userIdentity" title={`${session.tenantLabel} · ${session.displayName}`}>
              <strong>{session.displayName}</strong>
              <span>{session.tenantLabel}</span>
            </div>
          </div>
        </header>

        {roleError.length > 0 ? (
          <div className="stateNotice error" role="alert">
            <CircleAlert size={17} aria-hidden="true" />
            <span>{roleError}</span>
          </div>
        ) : null}

        {activeModule === "dispatch" ? (
          <div className="workspaceBody dispatchWorkspace">
            <DispatchPlanner
              selectedRoleId={selectedRoleId}
              canDispatch={selectedRole?.canDispatch ?? false}
              onTodayWorkCreated={(work) => {
                setCreatedWorkItems((current) =>
                  current.some((item) => item.id === work.id) ? current : [work, ...current],
                );
                setSelectedId(work.id);
              }}
            />
          </div>
        ) : activeModule === "exceptions" ? (
          <div className="workspaceBody riskWorkspace">
            <RiskInbox selectedRoleId={selectedRoleId} />
          </div>
        ) : (
          <div className={`workspaceBody${drawerOpen ? "" : " drawerClosed"}`}>
            <section className="commandSurface" aria-label="今日运输工作流">
              <div className="workspaceHeading">
                <div>
                  <p>{selectedRole?.workspace ?? "运输工作台"}</p>
                  <h1>今天需要完成的运输工作</h1>
                  <span>
                    8 月 25 日 · 华东组织 · 共 {12 + createdWorkItems.length} 项，3 项需要立即处理
                  </span>
                </div>
                <button
                  className="secondaryButton"
                  type="button"
                  aria-label={"\u5237\u65B0\u672C\u5730\u6570\u636E"}
                  title={"\u5237\u65B0\u672C\u5730\u6570\u636E"}
                >
                  <RefreshCcw size={16} aria-hidden="true" />
                  <span>刷新本地数据</span>
                </button>
              </div>

              <div className="stateNotice warning" role="status">
                <WifiOff size={17} aria-hidden="true" />
                <div>
                  <strong>G7 与高德尚未连接</strong>
                  <span>当前仅显示本地合成数据；不会读取生产事实或执行真实写入。</span>
                </div>
              </div>

              <div className="workToolbar">
                <fieldset className="filters">
                  <legend className="srOnly">工作筛选</legend>
                  <button className="filterButton active" type="button">
                    全部 <span>{12 + createdWorkItems.length}</span>
                  </button>
                  <button className="filterButton" type="button">
                    已超时 <span>2</span>
                  </button>
                  <button className="filterButton" type="button">
                    待审批 <span>1</span>
                  </button>
                  <button
                    className="iconButton"
                    type="button"
                    aria-label="更多筛选"
                    title="更多筛选"
                  >
                    <ListFilter size={18} aria-hidden="true" />
                  </button>
                </fieldset>
                <fieldset className="viewSwitch">
                  <legend className="srOnly">工作视图</legend>
                  <button
                    className={view === "list" ? "active" : ""}
                    type="button"
                    onClick={() => setView("list")}
                    aria-pressed={view === "list"}
                    title="列表"
                  >
                    <List size={17} aria-hidden="true" />
                    <span className="srOnly">列表</span>
                  </button>
                  <button
                    className={view === "timeline" ? "active" : ""}
                    type="button"
                    onClick={() => setView("timeline")}
                    aria-pressed={view === "timeline"}
                    title="时间线"
                  >
                    <Clock3 size={17} aria-hidden="true" />
                    <span className="srOnly">时间线</span>
                  </button>
                  <button
                    className={view === "map" ? "active" : ""}
                    type="button"
                    onClick={() => setView("map")}
                    aria-pressed={view === "map"}
                    title="地图证据"
                  >
                    <MapIcon size={17} aria-hidden="true" />
                    <span className="srOnly">地图证据</span>
                  </button>
                </fieldset>
              </div>

              {view === "map" ? (
                <MapFallback
                  items={filteredItems}
                  selectedId={selectedItem?.id ?? ""}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setDrawerOpen(true);
                  }}
                />
              ) : (
                <WorkList
                  items={filteredItems}
                  selectedId={selectedItem?.id ?? ""}
                  acceptedIds={acceptedIds}
                  view={view}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setDrawerOpen(true);
                  }}
                />
              )}
            </section>

            {drawerOpen && selectedItem !== undefined ? (
              <ContextDrawer
                item={selectedItem}
                accepted={acceptedIds.has(selectedItem.id)}
                contextTab={contextTab}
                requestId={session.requestId}
                onTabChange={setContextTab}
                onAccept={acceptSelectedWork}
                onClose={() => setDrawerOpen(false)}
              />
            ) : (
              <button
                className="drawerRestore"
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="恢复对象上下文"
                title="恢复对象上下文"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function WorkList({
  items,
  selectedId,
  acceptedIds,
  view,
  onSelect,
}: Readonly<{
  items: readonly WorkItem[];
  selectedId: string;
  acceptedIds: ReadonlySet<string>;
  view: Exclude<WorkView, "map">;
  onSelect: (id: string) => void;
}>) {
  if (items.length === 0) {
    return (
      <div className="emptyState">
        <Search size={24} aria-hidden="true" />
        <strong>没有匹配的运输工作</strong>
        <span>调整搜索词后，当前选择仍会保留。</span>
      </div>
    );
  }

  return (
    <div className={`workList ${view}`}>
      <div className="workListHeader" aria-hidden="true">
        <span>优先级 / 时限</span>
        <span>对象与路线</span>
        <span>变化与事实</span>
        <span>责任状态</span>
      </div>
      <ul aria-label="运输工作列表">
        {items.map((item) => {
          const accepted = acceptedIds.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`workRow ${item.urgency}${item.id === selectedId ? " selected" : ""}`}
                onClick={() => onSelect(item.id)}
                aria-current={item.id === selectedId ? "true" : undefined}
              >
                <span className="priorityCell">
                  {item.urgency === "critical" ? (
                    <CircleAlert size={17} aria-hidden="true" />
                  ) : item.urgency === "warning" ? (
                    <TriangleAlert size={17} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  )}
                  <span>
                    <strong>{urgencyLabel(item.urgency)}</strong>
                    <small>{item.due}</small>
                  </span>
                </span>
                <span className="objectCell">
                  <strong className="mono">{item.objectId}</strong>
                  <small>{item.route}</small>
                </span>
                <span className="factCell">
                  <strong>{item.summary}</strong>
                  <small>
                    {item.source} · {item.freshness}
                  </small>
                </span>
                <span className="ownerCell">
                  <strong>{accepted ? "本次浏览器已接手" : item.owner}</strong>
                  <small>{item.category}</small>
                  <ChevronRight size={16} aria-hidden="true" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MapFallback({
  items,
  selectedId,
  onSelect,
}: Readonly<{
  items: readonly WorkItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}>) {
  return (
    <div className="mapLayout">
      <section className="mapObjectList" aria-label="地图对象清单">
        <div className="mapListHeading">
          <strong>{items.length} 个对象</strong>
          <span>清单与位置证据一致</span>
        </div>
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === selectedId ? "active" : ""}
            onClick={() => onSelect(item.id)}
          >
            <MapPinned size={17} aria-hidden="true" />
            <span>
              <strong className="mono">{item.objectId}</strong>
              <small>{item.location}</small>
              <em>{item.freshness}</em>
            </span>
          </button>
        ))}
      </section>
      <div className="mapFallback" role="img" aria-label="高德地图未绑定，显示文字位置降级">
        <div className="mapFallbackNotice">
          <WifiOff size={22} aria-hidden="true" />
          <strong>地图服务未绑定</strong>
          <span>文字位置、新鲜度和处置入口仍可使用</span>
        </div>
        <div className="routeLine" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>华东运输走廊 · 本地降级视图</p>
      </div>
    </div>
  );
}

function ContextDrawer({
  item,
  accepted,
  contextTab,
  requestId,
  onTabChange,
  onAccept,
  onClose,
}: Readonly<{
  item: WorkItem;
  accepted: boolean;
  contextTab: ContextTab;
  requestId: string;
  onTabChange: (tab: ContextTab) => void;
  onAccept: () => void;
  onClose: () => void;
}>) {
  return (
    <aside className="contextDrawer" aria-label={`${item.objectId} 对象上下文`}>
      <div className="drawerHeader">
        <div>
          <span>{item.category}对象</span>
          <h2 className="mono">{item.objectId}</h2>
          <p>{item.route}</p>
        </div>
        <button
          className="iconButton"
          type="button"
          onClick={onClose}
          aria-label="收起对象上下文"
          title="收起对象上下文"
        >
          <PanelRightClose size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={`objectState ${item.urgency}`}>
        <span>{urgencyLabel(item.urgency)}</span>
        <strong>{item.due}</strong>
      </div>

      <div className="dataPulse">
        <Radio size={17} aria-hidden="true" />
        <div>
          <strong>{item.freshness}</strong>
          <span>{item.source} · 未连接 G7</span>
        </div>
      </div>

      <div className="contextTabs" role="tablist" aria-label="对象详情视图">
        {CONTEXT_TABS.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={contextTab === tab.id}
            className={contextTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="contextContent">
        {contextTab === "now" ? (
          <>
            <section>
              <h3>当前影响</h3>
              <p>{item.summary}</p>
            </section>
            <dl className="factGrid">
              <div>
                <dt>文字位置</dt>
                <dd>{item.location}</dd>
              </div>
              <div>
                <dt>责任状态</dt>
                <dd>{accepted ? "本次浏览器已接手（未保存）" : item.owner}</dd>
              </div>
              <div>
                <dt>数据归属</dt>
                <dd>本地合成，仅供开发测试</dd>
              </div>
            </dl>
          </>
        ) : null}
        {contextTab === "timeline" ? (
          <ol className="timelineList">
            <li>
              <span>09:54</span>
              <div>
                <strong>工作进入今日队列</strong>
                <p>
                  {item.source} · {item.freshness}
                </p>
              </div>
            </li>
            <li>
              <span>09:48</span>
              <div>
                <strong>本地合成事实更新</strong>
                <p>未向 G7 或高德发起请求</p>
              </div>
            </li>
          </ol>
        ) : null}
        {contextTab === "record" ? (
          <div className="stateNotice neutral">
            <Boxes size={17} aria-hidden="true" />
            <span>对象档案依赖经签名验证的 G7 SANDBOX 合同，当前保持关闭。</span>
          </div>
        ) : null}
        {contextTab === "audit" ? (
          <dl className="auditList">
            <div>
              <dt>请求 ID</dt>
              <dd className="mono">{requestId}</dd>
            </div>
            <div>
              <dt>来源应用</dt>
              <dd>WEB_BFF · LOCAL_SYNTHETIC</dd>
            </div>
            <div>
              <dt>真实写入</dt>
              <dd>已关闭</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="drawerActions">
        <button className="primaryButton" type="button" onClick={onAccept} disabled={accepted}>
          <Navigation size={17} aria-hidden="true" />
          {accepted ? "本次浏览器已接手" : item.nextAction}
        </button>
        <button className="secondaryButton" type="button">
          <Phone size={17} aria-hidden="true" />
          联系责任人
        </button>
        <p aria-live="polite">
          {accepted ? "状态仅保存在当前页面，未写入 G7 或数据库。" : "接手前不会产生外部写入。"}
        </p>
      </div>
    </aside>
  );
}
