import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bell,
  Brain,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Command,
  Folder,
  Gauge,
  Grid2X2,
  Image,
  Info,
  Inbox,
  ListTodo,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ViewKey =
  | "inbox"
  | "today"
  | "upcoming"
  | "someday"
  | "completed"
  | "quadrants"
  | "project"

type Bucket = "inbox" | "today" | "upcoming" | "someday"
type RepeatRule = "once" | "daily"

type Task = {
  id: number
  title: string
  notes: string
  bucket: Bucket
  project: string
  plannedDate: string
  dueLabel: string
  reminderLabel: string
  repeatRule: RepeatRule
  important: boolean | null
  urgent: boolean | null
  completed: boolean
  attachmentCount: number
  steps: string[]
}

type QuadrantKey = "urgent" | "important" | "critical" | "low" | "unclassified"

const initialProjects = [
  { name: "工作事务", color: "#282828" },
  { name: "招聘推进", color: "#747474" },
  { name: "个人生活", color: "#aaa9a5" },
]

const initialTasks: Task[] = [
  {
    id: 1,
    title: "把供应商资料发给李经理",
    notes: "领导刚刚口头交代，先确认附件版本，再发邮件。",
    bucket: "inbox",
    project: "工作事务",
    plannedDate: "",
    dueLabel: "2026-08-08 16:30",
    reminderLabel: "2026-08-08 16:00",
    repeatRule: "once",
    important: null,
    urgent: null,
    completed: false,
    attachmentCount: 1,
    steps: [],
  },
  {
    id: 2,
    title: "完成门店巡检周报",
    notes: "汇总本周 4 家门店的异常项，发给区域负责人。",
    bucket: "today",
    project: "工作事务",
    plannedDate: "今天",
    dueLabel: "2026-08-08 17:30",
    reminderLabel: "2026-08-08 16:45",
    repeatRule: "once",
    important: true,
    urgent: true,
    completed: false,
    attachmentCount: 0,
    steps: ["打开上周周报模板", "把四家门店异常截图放进对应章节"],
  },
  {
    id: 3,
    title: "整理采购候选人电话记录",
    notes: "重点补齐待遇、单双休、离职原因和稳定性。",
    bucket: "today",
    project: "招聘推进",
    plannedDate: "今天",
    dueLabel: "2026-08-09 10:00",
    reminderLabel: "2026-08-09 09:30",
    repeatRule: "once",
    important: false,
    urgent: true,
    completed: false,
    attachmentCount: 0,
    steps: [],
  },
  {
    id: 4,
    title: "准备周五供应商会议提纲",
    notes: "先列清楚本次要确认的三个问题。",
    bucket: "upcoming",
    project: "工作事务",
    plannedDate: "明天",
    dueLabel: "2026-08-14 14:00",
    reminderLabel: "2026-08-14 13:30",
    repeatRule: "once",
    important: true,
    urgent: false,
    completed: false,
    attachmentCount: 0,
    steps: [],
  },
  {
    id: 5,
    title: "学习供应商质量 8D 分析",
    notes: "不是当前最急，保留到有完整时间时处理。",
    bucket: "someday",
    project: "个人生活",
    plannedDate: "以后",
    dueLabel: "",
    reminderLabel: "",
    repeatRule: "daily",
    important: true,
    urgent: false,
    completed: false,
    attachmentCount: 0,
    steps: [],
  },
  {
    id: 6,
    title: "提交本周考勤确认",
    notes: "",
    bucket: "today",
    project: "工作事务",
    plannedDate: "今天",
    dueLabel: "2026-08-08 09:20",
    reminderLabel: "",
    repeatRule: "once",
    important: false,
    urgent: false,
    completed: true,
    attachmentCount: 0,
    steps: [],
  },
]

const viewMeta: Record<Exclude<ViewKey, "project">, { title: string; hint: string }> = {
  inbox: { title: "收集箱", hint: "先接住，不要求现在整理" },
  today: { title: "今天", hint: "现在只看今天真正要推进的事" },
  upcoming: { title: "未来", hint: "已经安排到某一天的任务" },
  someday: { title: "以后", hint: "想做，但现在不需要占用注意力" },
  completed: { title: "已完成", hint: "做过的事情不会消失" },
  quadrants: { title: "四象限", hint: "用重要和紧急帮助你做选择" },
}

function quadrantOf(task: Task): QuadrantKey {
  if (task.important === null || task.urgent === null) return "unclassified"
  if (task.important && task.urgent) return "critical"
  if (task.important) return "important"
  if (task.urgent) return "urgent"
  return "low"
}

function taskBelongsToView(task: Task, view: ViewKey, project: string) {
  if (view === "completed") return task.completed
  if (task.completed) return false
  if (view === "project") return task.project === project
  if (view === "quadrants") return true
  return task.bucket === view
}

const quadrantMeta: Record<QuadrantKey, { label: string; short: string }> = {
  critical: { label: "紧急且重要", short: "现在做" },
  important: { label: "重要不紧急", short: "安排做" },
  urgent: { label: "紧急不重要", short: "快速处理" },
  low: { label: "不紧急不重要", short: "减少或推迟" },
  unclassified: { label: "未分类", short: "之后整理" },
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [projectList, setProjectList] = useState(initialProjects)
  const [activeView, setActiveView] = useState<ViewKey>("today")
  const [activeProject, setActiveProject] = useState("工作事务")
  const [selectedId, setSelectedId] = useState<number>(2)
  const [search, setSearch] = useState("")
  const [captureOpen, setCaptureOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(true)
  const [toast, setToast] = useState("")
  const [aiUndo, setAiUndo] = useState<{ taskId: number; previousSteps: string[] } | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.code === "Space") {
        event.preventDefault()
        setCaptureOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null

  const visibleTasks = useMemo(() => {
    const byView = tasks.filter((task) => taskBelongsToView(task, activeView, activeProject))
    const keyword = search.trim().toLowerCase()
    if (!keyword) return byView
    return byView.filter(
      (task) =>
        task.title.toLowerCase().includes(keyword) ||
        task.notes.toLowerCase().includes(keyword) ||
        task.project.toLowerCase().includes(keyword)
    )
  }, [activeProject, activeView, search, tasks])

  const titleMeta =
    activeView === "project"
      ? { title: activeProject, hint: "这个项目里的下一步都在这里" }
      : viewMeta[activeView]

  const updateTask = (id: number, patch: Partial<Task>) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task))
    )
  }

  const selectView = (view: ViewKey) => {
    setActiveView(view)
    setSearch("")
    const firstTask = tasks.find((task) => taskBelongsToView(task, view, activeProject))
    if (firstTask) setSelectedId(firstTask.id)
  }

  const selectTask = (id: number) => {
    setSelectedId(id)
    setDetailOpen(true)
  }

  const toggleTask = (task: Task) => {
    if (task.completed) {
      updateTask(task.id, { completed: false })
      setActiveView(task.bucket)
      setSelectedId(task.id)
      setToast(`已恢复到${task.plannedDate || "原来的列表"}`)
      return
    }
    updateTask(task.id, { completed: true })
    setSelectedId(task.id)
    setToast("已完成；误点可在“已完成”中恢复")
  }

  const addProject = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (projectList.some((project) => project.name === trimmed)) {
      setToast("已经有同名项目了")
      return
    }
    const palette = ["#40403e", "#6f6f6a", "#a2a29c", "#555b63", "#84796d"]
    setProjectList((current) => [...current, { name: trimmed, color: palette[current.length % palette.length] }])
    setActiveProject(trimmed)
    setActiveView("project")
    setToast(`已添加项目“${trimmed}”`)
  }

  const renameProject = (oldName: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    if (projectList.some((project) => project.name === trimmed)) {
      setToast("已经有同名项目了")
      return
    }
    setProjectList((current) => current.map((project) => project.name === oldName ? { ...project, name: trimmed } : project))
    setTasks((current) => current.map((task) => task.project === oldName ? { ...task, project: trimmed } : task))
    if (activeProject === oldName) setActiveProject(trimmed)
    setToast(`项目已重命名为“${trimmed}”`)
  }

  const addCapturedTask = (title: string, hasAttachment: boolean) => {
    const id = Math.max(...tasks.map((task) => task.id)) + 1
    const newTask: Task = {
      id,
      title,
      notes: "",
      bucket: "inbox",
      project: projectList[0]?.name ?? "未分类项目",
      plannedDate: "",
      dueLabel: "",
      reminderLabel: "",
      repeatRule: "once",
      important: null,
      urgent: null,
      completed: false,
      attachmentCount: hasAttachment ? 1 : 0,
      steps: [],
    }
    setTasks((current) => [newTask, ...current])
    setActiveView("inbox")
    setSelectedId(id)
    setToast("已接住，放进收集箱了")
  }

  const counts = {
    inbox: tasks.filter((task) => task.bucket === "inbox" && !task.completed).length,
    today: tasks.filter((task) => task.bucket === "today" && !task.completed).length,
    upcoming: tasks.filter((task) => task.bucket === "upcoming" && !task.completed).length,
    someday: tasks.filter((task) => task.bucket === "someday" && !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
  }

  return (
    <div className={detailOpen ? "app-shell" : "app-shell detail-closed"}>
      <Sidebar
        activeView={activeView}
        activeProject={activeProject}
        projects={projectList}
        counts={counts}
        onSelectView={selectView}
        onSelectProject={(project) => {
          setActiveProject(project)
          setActiveView("project")
          const firstTask = tasks.find((task) => taskBelongsToView(task, "project", project))
          if (firstTask) setSelectedId(firstTask.id)
        }}
        onAddProject={addProject}
        onRenameProject={renameProject}
      />

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <div className="eyebrow">2026 年 8 月 5 日 · 星期三</div>
            <h1>{titleMeta.title}</h1>
            <p>{titleMeta.hint}</p>
          </div>
          <div className="header-actions">
            <Button variant="outline" size="lg" onClick={() => setPlannerOpen(true)}>
              <Calendar data-icon="inline-start" />
              安排明天
            </Button>
            <Button size="lg" onClick={() => setCaptureOpen(true)}>
              <Plus data-icon="inline-start" />
              记下一件事
            </Button>
          </div>
        </header>

        <div className="search-row">
          <Search aria-hidden="true" />
          <input
            aria-label="搜索任务"
            placeholder="搜索当前列表"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span>{visibleTasks.length} 件事</span>
        </div>

        {activeView === "quadrants" ? (
          <QuadrantBoard
            tasks={visibleTasks}
            selectedId={selectedId}
            onSelect={selectTask}
            onToggle={toggleTask}
          />
        ) : (
          <TaskList
            tasks={visibleTasks}
            selectedId={selectedId}
            activeView={activeView}
            onSelect={selectTask}
            onToggle={toggleTask}
            onCapture={() => setCaptureOpen(true)}
          />
        )}
      </main>

      {detailOpen && (
        <TaskDetail
          task={selectedTask}
          projects={projectList}
          onChange={(patch) => {
            if (!selectedTask) return
            updateTask(selectedTask.id, patch)
            if (patch.bucket === "inbox" && patch.important === null && patch.urgent === null) {
              setActiveView("inbox")
              setToast("已取消象限选择，任务回到收集箱")
            }
          }}
          onOpenAi={() => setAiOpen(true)}
          onUndoAi={aiUndo?.taskId === selectedTask?.id ? () => {
            if (!aiUndo) return
            updateTask(aiUndo.taskId, { steps: aiUndo.previousSteps })
            setAiUndo(null)
            setToast("已撤销 AI 拆解")
          } : undefined}
          onClose={() => setDetailOpen(false)}
          onRestore={() => {
            if (!selectedTask) return
            toggleTask(selectedTask)
          }}
        />
      )}

      {captureOpen && (
        <QuickCapture
          onClose={() => setCaptureOpen(false)}
          onSave={(title, hasAttachment) => {
            addCapturedTask(title, hasAttachment)
            setCaptureOpen(false)
          }}
        />
      )}

      {aiOpen && selectedTask && (
        <AiBreakdown
          task={selectedTask}
          onClose={() => setAiOpen(false)}
          onApply={(steps) => {
            setAiUndo({ taskId: selectedTask.id, previousSteps: [...selectedTask.steps] })
            updateTask(selectedTask.id, { steps })
            setAiOpen(false)
            setToast("已采用第一步，可在任务中撤销")
          }}
        />
      )}

      {plannerOpen && (
        <TomorrowPlanner
          tasks={tasks.filter((task) => !task.completed)}
          onClose={() => setPlannerOpen(false)}
          onApply={(ids) => {
            setTasks((current) =>
              current.map((task) =>
                ids.includes(task.id)
                  ? { ...task, bucket: "upcoming", plannedDate: "明天" }
                  : task
              )
            )
            setPlannerOpen(false)
            setActiveView("upcoming")
            setToast(`明天安排了 ${ids.length} 件事`)
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <Check />
          {toast}
        </div>
      )}
    </div>
  )
}

function Sidebar({
  activeView,
  activeProject,
  projects,
  counts,
  onSelectView,
  onSelectProject,
  onAddProject,
  onRenameProject,
}: {
  activeView: ViewKey
  activeProject: string
  projects: Array<{ name: string; color: string }>
  counts: Record<"inbox" | "today" | "upcoming" | "someday" | "completed", number>
  onSelectView: (view: ViewKey) => void
  onSelectProject: (project: string) => void
  onAddProject: (project: string) => void
  onRenameProject: (oldName: string, newName: string) => void
}) {
  const [addingProject, setAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const navItems: Array<{
    key: Exclude<ViewKey, "project">
    label: string
    icon: ReactNode
    count?: number
  }> = [
    { key: "inbox", label: "收集箱", icon: <Inbox />, count: counts.inbox },
    { key: "today", label: "今天", icon: <Sun />, count: counts.today },
    { key: "upcoming", label: "未来", icon: <CalendarDays />, count: counts.upcoming },
    { key: "someday", label: "以后", icon: <Archive />, count: counts.someday },
    { key: "completed", label: "已完成", icon: <CheckCircle2 />, count: counts.completed },
    { key: "quadrants", label: "四象限", icon: <Grid2X2 /> },
  ]

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false)
    }
    window.addEventListener("mousedown", closeMenu)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("mousedown", closeMenu)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

  return (
    <>
      <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">1</div>
        <div>
          <strong>第一步</strong>
          <span>OneStep</span>
        </div>
      </div>

      <nav className="nav-section" aria-label="任务视图">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={activeView === item.key ? "nav-item active" : "nav-item"}
            onClick={() => onSelectView(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.count !== undefined && <em>{item.count}</em>}
          </button>
        ))}
      </nav>

      <div className="sidebar-label">
        <span>项目</span>
        <button aria-label="添加项目" onClick={() => setAddingProject(true)}><Plus /></button>
      </div>
      <nav className="nav-section project-nav" aria-label="项目">
        {addingProject && (
          <form
            className="project-edit-row"
            onSubmit={(event) => {
              event.preventDefault()
              if (!newProjectName.trim()) return
              onAddProject(newProjectName)
              setNewProjectName("")
              setAddingProject(false)
            }}
          >
            <i className="new-project-dot" />
            <input
              autoFocus
              aria-label="新项目名称"
              value={newProjectName}
              placeholder="输入项目名称"
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setNewProjectName("")
                  setAddingProject(false)
                }
              }}
            />
            <button type="submit" aria-label="保存新项目"><Check /></button>
          </form>
        )}
        {projects.map((project) => (
          renamingProject === project.name ? (
            <div className="project-edit-row" key={project.name}>
              <i style={{ background: project.color }} />
              <input
                autoFocus
                aria-label={`重命名${project.name}`}
                value={renameValue}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => {
                  onRenameProject(project.name, renameValue)
                  setRenamingProject(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onRenameProject(project.name, renameValue)
                    setRenamingProject(null)
                  }
                  if (event.key === "Escape") setRenamingProject(null)
                }}
              />
              <button
                type="button"
                aria-label="保存项目名称"
                onClick={() => {
                  onRenameProject(project.name, renameValue)
                  setRenamingProject(null)
                }}
              ><Check /></button>
            </div>
          ) : (
            <button
              key={project.name}
              className={
                activeView === "project" && activeProject === project.name
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => onSelectProject(project.name)}
              onDoubleClick={() => {
                setRenamingProject(project.name)
                setRenameValue(project.name)
              }}
            >
              <i style={{ background: project.color }} />
              <span>{project.name}</span>
            </button>
          )
        ))}
      </nav>

        <div className="sidebar-footer">
          <div className="profile-shell" ref={profileMenuRef}>
            {profileMenuOpen && (
              <div className="profile-menu" role="menu" aria-label="账户菜单">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    setSettingsOpen(true)
                  }}
                >
                  <Settings />
                  <span><strong>设置</strong><small>偏好、快捷键与数据</small></span>
                  <ChevronRight />
                </button>
                <div className="usage-summary">
                  <div><Gauge /><strong>剩余用量</strong><span>尚未接入</span></div>
                  <p>真实 AI 尚未启用，目前没有调用额度或费用。</p>
                </div>
                <div className="profile-menu-meta"><Command /><span>快捷记录</span><kbd>Ctrl Alt Space</kbd></div>
                <div className="profile-menu-meta"><Info /><span>关于 OneStep</span><small>v0.1.0</small></div>
              </div>
            )}
            <div className="profile">
              <div className="avatar">左</div>
              <div>
                <strong>左仕榆</strong>
                <span>本地模式</span>
              </div>
              <button
                type="button"
                className={profileMenuOpen ? "profile-menu-trigger active" : "profile-menu-trigger"}
                aria-label="打开账户菜单"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              ><MoreHorizontal /></button>
            </div>
          </div>
        </div>
      </aside>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

function TaskList({
  tasks,
  selectedId,
  activeView,
  onSelect,
  onToggle,
  onCapture,
}: {
  tasks: Task[]
  selectedId: number
  activeView: ViewKey
  onSelect: (id: number) => void
  onToggle: (task: Task) => void
  onCapture: () => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ListTodo /></div>
        <h2>这里暂时没有任务</h2>
        <p>不用为了填满列表而制造事情。想到什么时，再把它接住。</p>
        <Button variant="outline" onClick={onCapture}>
          <Plus /> 记下一件事
        </Button>
      </div>
    )
  }

  const incomplete = tasks.filter((task) => !task.completed)
  const complete = tasks.filter((task) => task.completed)
  const primaryTasks = activeView === "completed" ? complete : incomplete

  return (
    <div className="task-list">
      <section>
        <div className="section-title">
          <span>{activeView === "completed" ? "可以恢复" : activeView === "inbox" ? "还没整理" : "下一步"}</span>
          <span>{primaryTasks.length}</span>
        </div>
        {primaryTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            selected={selectedId === task.id}
            onSelect={onSelect}
            onToggle={onToggle}
            showRestore={activeView === "completed"}
          />
        ))}
      </section>
      {complete.length > 0 && activeView !== "completed" && (
        <section className="completed-section">
          <div className="section-title"><span>今天已完成</span><span>{complete.length}</span></div>
          {complete.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={selectedId === task.id}
              onSelect={onSelect}
              onToggle={onToggle}
              showRestore={false}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function TaskRow({
  task,
  selected,
  onSelect,
  onToggle,
  showRestore,
}: {
  task: Task
  selected: boolean
  onSelect: (id: number) => void
  onToggle: (task: Task) => void
  showRestore: boolean
}) {
  const quadrant = quadrantMeta[quadrantOf(task)]
  return (
    <article className={selected ? "task-row selected" : "task-row"} onClick={() => onSelect(task.id)}>
      <button
        className={task.completed ? "task-check checked" : "task-check"}
        aria-label={task.completed ? "恢复任务" : "完成任务"}
        onClick={(event) => {
          event.stopPropagation()
          onToggle(task)
        }}
      >
        {task.completed ? <Check /> : <Circle />}
      </button>
      <div className="task-copy">
        <div className="task-title-line">
          <h3>{task.title}</h3>
          {task.attachmentCount > 0 && <Paperclip aria-label="有附件" />}
        </div>
        <div className="task-meta">
          {task.dueLabel && (
            <span className={task.dueLabel.startsWith(todayDateValue()) ? "due" : ""}>
              <Clock /> {formatDateTimeDisplay(task.dueLabel)}
            </span>
          )}
          <span><Folder /> {task.project}</span>
          <span className={`quadrant-dot q-${quadrantOf(task)}`}>{quadrant.label}</span>
        </div>
        {task.steps.length > 0 && !task.completed && (
          <div className="next-step"><ArrowRight /> 第一步：{task.steps[0]}</div>
        )}
      </div>
      {showRestore ? (
        <button
          className="inline-restore"
          onClick={(event) => {
            event.stopPropagation()
            onToggle(task)
          }}
        >
          <RotateCcw /> 恢复
        </button>
      ) : (
        <ChevronRight className="row-arrow" />
      )}
    </article>
  )
}

function QuadrantBoard({
  tasks,
  selectedId,
  onSelect,
  onToggle,
}: {
  tasks: Task[]
  selectedId: number
  onSelect: (id: number) => void
  onToggle: (task: Task) => void
}) {
  const order: QuadrantKey[] = ["critical", "important", "urgent", "low"]
  return (
    <div className="quadrant-board">
      {order.map((key) => {
        const meta = quadrantMeta[key]
        const quadrantTasks = tasks.filter((task) => quadrantOf(task) === key)
        return (
          <section key={key} className={`quadrant-card q-card-${key}`}>
            <header>
              <div><span className={`quadrant-pin q-${key}`} /><h2>{meta.label}</h2></div>
              <Badge variant="outline">{meta.short}</Badge>
            </header>
            <div className="quadrant-tasks">
              {quadrantTasks.length === 0 ? (
                <p className="quadrant-empty">暂时没有</p>
              ) : (
                quadrantTasks.map((task) => (
                  <button
                    key={task.id}
                    className={selectedId === task.id ? "quadrant-task selected" : "quadrant-task"}
                    onClick={() => onSelect(task.id)}
                  >
                    <span
                      className={task.completed ? "mini-check checked" : "mini-check"}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggle(task)
                      }}
                    >
                      {task.completed && <Check />}
                    </span>
                    <span>{task.title}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

const reminderHourOptions = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, "0"))
const reminderMinuteOptions = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0"))

function todayDateValue() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function parseDateTimeValue(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})\s(\d{2}):(\d{2})$/)
  return {
    date: match?.[1] ?? todayDateValue(),
    hour: match?.[2] ?? "09",
    minute: match?.[3] ?? "00",
  }
}

function formatDateTimeDisplay(value: string) {
  const parsed = parseDateTimeValue(value)
  if (!value) return ""
  return `${parsed.date.replaceAll("-", "/")} ${parsed.hour}:${parsed.minute}`
}

function dateFromValue(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day, 12)
}

function dateToValue(date: Date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

function MonthCalendar({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const selectedDate = dateFromValue(value || todayDateValue())
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12),
  )
  const today = todayDateValue()

  const days = useMemo(() => {
    const mondayOffset = (viewMonth.getDay() + 6) % 7
    const firstCell = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1 - mondayOffset, 12)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCell)
      date.setDate(firstCell.getDate() + index)
      return {
        value: dateToValue(date),
        day: date.getDate(),
        outside: date.getMonth() !== viewMonth.getMonth(),
      }
    })
  }, [viewMonth])

  const moveMonth = (offset: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12))
  }

  return (
    <div className="month-calendar" aria-label={`${label}日历`}>
      <div className="calendar-toolbar">
        <button aria-label={`${label}上个月`} onClick={() => moveMonth(-1)}><ChevronLeft /></button>
        <strong>{viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月</strong>
        <button aria-label={`${label}下个月`} onClick={() => moveMonth(1)}><ChevronRight /></button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {['一', '二', '三', '四', '五', '六', '日'].map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="calendar-days">
        {days.map((item) => (
          <button
            key={item.value}
            aria-label={`${label}日期 ${item.value}`}
            aria-pressed={item.value === value}
            className={[
              item.value === value ? "selected" : "",
              item.value === today ? "today" : "",
              item.outside ? "outside" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              onChange(item.value)
              if (item.outside) {
                const next = dateFromValue(item.value)
                setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12))
              }
            }}
          >
            {item.day}
          </button>
        ))}
      </div>
      <button
        className="calendar-today"
        onClick={() => {
          const next = dateFromValue(today)
          onChange(today)
          setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12))
        }}
      >
        回到今天
      </button>
    </div>
  )
}

function WheelColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const itemHeight = 36

  useEffect(() => {
    const index = Math.max(0, options.indexOf(value))
    if (ref.current) ref.current.scrollTop = index * itemHeight
  }, [options, value])

  return (
    <div className="wheel-wrap">
      <span>{label}</span>
      <div
        ref={ref}
        className="wheel-column"
        onWheel={(event) => {
          event.preventDefault()
          const currentIndex = Math.max(0, options.indexOf(value))
          const direction = event.deltaY > 0 ? 1 : -1
          const nextIndex = Math.min(options.length - 1, Math.max(0, currentIndex + direction))
          onChange(options[nextIndex])
          ref.current?.scrollTo({ top: nextIndex * itemHeight, behavior: "smooth" })
        }}
      >
        {options.map((option) => (
          <button
            key={option}
            className={option === value ? "selected" : ""}
            onClick={() => {
              onChange(option)
              ref.current?.scrollTo({ top: options.indexOf(option) * itemHeight, behavior: "smooth" })
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function DateTimeWheel({
  label,
  icon,
  value,
  placeholder,
  heading,
  previewVerb,
  alignRight = false,
  onChange,
}: {
  label: string
  icon: ReactNode
  value: string
  placeholder: string
  heading: string
  previewVerb: string
  alignRight?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const parsed = parseDateTimeValue(value)
  const [date, setDate] = useState(parsed.date)
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  return (
    <div className={alignRight ? "picker-field datetime-picker align-right" : "picker-field datetime-picker"} ref={rootRef}>
      <span className="field-label">{icon} {label}</span>
      <button
        aria-label={`设置${label}`}
        className={open ? "picker-trigger active" : "picker-trigger"}
        onClick={() => {
          if (!open) {
            const next = parseDateTimeValue(value)
            setDate(next.date)
            setHour(next.hour)
            setMinute(next.minute)
          }
          setOpen((current) => !current)
        }}
      >
        <span>{value ? formatDateTimeDisplay(value) : placeholder}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="wheel-popover">
          <div className="picker-heading">
            <div><Clock /><strong>{heading}</strong></div>
            <button onClick={() => { onChange(""); setOpen(false) }}>清除</button>
          </div>
          <MonthCalendar label={label} value={date} onChange={setDate} />
          <div className="wheel-grid time-only">
            <WheelColumn label="小时" options={reminderHourOptions} value={hour} onChange={setHour} />
            <WheelColumn label="分钟" options={reminderMinuteOptions} value={minute} onChange={setMinute} />
          </div>
          <div className="picker-preview">{previewVerb} <strong>{date.replaceAll("-", "/")} {hour}:{minute}</strong></div>
          <Button size="sm" disabled={!date} onClick={() => { onChange(`${date} ${hour}:${minute}`); setOpen(false) }}>确认时间</Button>
        </div>
      )}
    </div>
  )
}

function RepeatPicker({ value, onChange }: { value: RepeatRule; onChange: (value: RepeatRule) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const options: Array<{ value: RepeatRule; label: string; hint: string }> = [
    { value: "once", label: "一次性", hint: "完成后不再生成" },
    { value: "daily", label: "每天重复", hint: "每天生成同一动作" },
  ]
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  return (
    <div className="picker-field repeat-picker" ref={rootRef}>
      <span className="field-label"><RotateCcw /> 重复</span>
      <button aria-label="设置重复方式" className={open ? "picker-trigger active" : "picker-trigger"} onClick={() => setOpen((current) => !current)}>
        <span>{selected.label}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="project-menu repeat-menu">
          {options.map((option) => (
            <button
              key={option.value}
              className={option.value === value ? "selected" : ""}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span><strong>{option.label}</strong><small>{option.hint}</small></span>
              {option.value === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatPlannedDate(value: string) {
  const [, month = "", day = ""] = value.split("-")
  return `${Number(month)} 月 ${Number(day)} 日`
}

function PlannedDatePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (patch: Pick<Task, "bucket" | "plannedDate">) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const displayValue = value === "以后" ? "以后再做" : value || "未安排"
  const customDateSelected = Boolean(value && !["今天", "明天", "以后"].includes(value))
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minimumDate = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-")

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const choose = (bucket: Bucket, plannedDate: string) => {
    onChange({ bucket, plannedDate })
    setOpen(false)
  }

  return (
    <div className="planned-date-picker" ref={rootRef}>
      <button
        className={open ? "schedule-trigger active" : "schedule-trigger"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="schedule-label"><Calendar /> 准备哪天做</span>
        <span className="schedule-current">{displayValue}<ChevronDown /></span>
      </button>

      {open && (
        <div className="schedule-menu" role="menu">
          <div className="schedule-quick-options">
            <button className={value === "今天" ? "selected" : ""} onClick={() => choose("today", "今天")}>
              今天
              {value === "今天" && <Check />}
            </button>
            <button className={value === "明天" ? "selected" : ""} onClick={() => choose("upcoming", "明天")}>
              明天
              {value === "明天" && <Check />}
            </button>
          </div>

          <label className={customDateSelected ? "schedule-date-row selected" : "schedule-date-row"}>
            <span>
              <strong>选择具体日期</strong>
              <small>{customDateSelected ? value : "安排到未来某一天"}</small>
            </span>
            <input
              type="date"
              min={minimumDate}
              aria-label="选择具体计划日期"
              onChange={(event) => {
                if (!event.target.value) return
                choose("upcoming", formatPlannedDate(event.target.value))
              }}
            />
          </label>

          <button className={value === "以后" ? "schedule-someday selected" : "schedule-someday"} onClick={() => choose("someday", "以后")}>
            <span>
              <strong>以后再做</strong>
              <small>保留任务，但暂时不安排日期</small>
            </span>
            {value === "以后" && <Check />}
          </button>
        </div>
      )}
    </div>
  )
}

function ProjectPicker({
  value,
  projects,
  onChange,
}: {
  value: string
  projects: Array<{ name: string; color: string }>
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  return (
    <div className="picker-field project-picker" ref={rootRef}>
      <span className="field-label"><Folder /> 项目</span>
      <button aria-label="设置项目" className={open ? "picker-trigger active" : "picker-trigger"} onClick={() => setOpen((current) => !current)}>
        <span>{value}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="project-menu">
          {projects.map((project) => (
            <button
              key={project.name}
              className={project.name === value ? "selected" : ""}
              onClick={() => {
                onChange(project.name)
                setOpen(false)
              }}
            >
              <i style={{ background: project.color }} />
              <span>{project.name}</span>
              {project.name === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskDetail({
  task,
  projects,
  onChange,
  onOpenAi,
  onUndoAi,
  onClose,
  onRestore,
}: {
  task: Task | null
  projects: Array<{ name: string; color: string }>
  onChange: (patch: Partial<Task>) => void
  onOpenAi: () => void
  onUndoAi?: () => void
  onClose: () => void
  onRestore: () => void
}) {
  if (!task) {
    return (
      <aside className="detail-panel detail-empty">
        <Circle />
        <p>选择一件事，查看它的下一步</p>
      </aside>
    )
  }

  const quadrants: Array<{ key: QuadrantKey; important: boolean; urgent: boolean }> = [
    { key: "critical", important: true, urgent: true },
    { key: "important", important: true, urgent: false },
    { key: "urgent", important: false, urgent: true },
    { key: "low", important: false, urgent: false },
  ]

  return (
    <aside className="detail-panel">
      <div className="detail-topline">
        <span>任务详情</span>
        <div>
          <button className="detail-close" aria-label="关闭任务详情" onClick={onClose}><X /></button>
        </div>
      </div>

      <div className="detail-title-row">
        <button
          className={task.completed ? "big-check checked" : "big-check"}
          onClick={() => onChange({ completed: !task.completed })}
        >
          {task.completed && <Check />}
        </button>
        <textarea
          aria-label="任务标题"
          value={task.title}
          rows={1}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>

      {task.completed ? (
        <Button variant="outline" className="restore-button" onClick={onRestore}>
          <RotateCcw /> 恢复到{task.plannedDate || "原来的列表"}
        </Button>
      ) : (
        <button className="ai-entry" onClick={onOpenAi}>
          <div className="ai-icon"><Sparkles /></div>
          <div>
            <strong>不知道怎么开始？</strong>
            <span>让 AI 帮你拆出一个最小第一步</span>
          </div>
          <ChevronRight />
        </button>
      )}

      {task.steps.length > 0 && !task.completed && (
        <section className="steps-card">
          <div className="steps-heading">
            <div className="field-label"><ListTodo /> 当前第一步</div>
            {onUndoAi && <button type="button" aria-label="撤销 AI 拆解" onClick={onUndoAi}><RotateCcw /> 撤销</button>}
          </div>
          {task.steps.map((step, index) => (
            <div className={index === 0 ? "step-item first" : "step-item"} key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </section>
      )}

      <section className="detail-section">
        <PlannedDatePicker value={task.plannedDate} onChange={onChange} />
      </section>

      <section className="detail-section detail-grid">
        <DateTimeWheel
          label="截止时间"
          icon={<CalendarDays />}
          value={task.dueLabel}
          placeholder="添加截止时间"
          heading="设置截止时间"
          previewVerb="最晚完成："
          onChange={(dueLabel) => onChange({ dueLabel })}
        />
        <DateTimeWheel
          label="提醒时间"
          icon={<Bell />}
          value={task.reminderLabel}
          placeholder="添加提醒时间"
          heading="设置提醒时间"
          previewVerb="将在"
          alignRight
          onChange={(reminderLabel) => onChange({ reminderLabel })}
        />
      </section>

      <section className="detail-section detail-grid">
        <ProjectPicker value={task.project} projects={projects} onChange={(project) => onChange({ project })} />
        <RepeatPicker value={task.repeatRule} onChange={(repeatRule) => onChange({ repeatRule })} />
      </section>

      <section className="detail-section">
        <div className="field-label"><Grid2X2 /> 四象限</div>
        <div className="quadrant-selector">
          {quadrants.map((item) => (
            <button
              key={item.key}
              className={quadrantOf(task) === item.key ? `active q-select-${item.key}` : ""}
              onClick={() => {
                if (quadrantOf(task) === item.key) {
                  onChange({ important: null, urgent: null, bucket: "inbox", plannedDate: "" })
                  return
                }
                onChange({ important: item.important, urgent: item.urgent })
              }}
            >
              <span className={`quadrant-pin q-${item.key}`} />
              {quadrantMeta[item.key].label}
            </button>
          ))}
        </div>
        <p className="helper-text">
          {quadrantOf(task) === "unclassified"
            ? "还没判断，不会自动算成“不紧急不重要”。"
            : "再次点击已选象限可取消，并把任务退回收集箱。"}
        </p>
      </section>

      <section className="detail-section notes-section">
        <label className="field-label"><ListTodo /> 备注</label>
        <Textarea
          value={task.notes}
          placeholder="补充必要背景，不用写得很完整"
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </section>

      <button className="attachment-row">
        <Paperclip />
        <span>{task.attachmentCount > 0 ? `${task.attachmentCount} 个附件` : "添加图片或附件"}</span>
        <Plus />
      </button>
    </aside>
  )
}

function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={wide ? "modal wide" : "modal"} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="settings-modal">
        <div className="settings-heading">
          <div className="settings-mark"><Settings /></div>
          <div>
            <span>本地原型</span>
            <h2>设置</h2>
            <p>先验证设置入口和信息层级，真实配置会在对应开发阶段接入。</p>
          </div>
          <button type="button" aria-label="关闭设置" onClick={onClose}><X /></button>
        </div>
        <div className="settings-list">
          <div className="settings-row">
            <Command />
            <span><strong>快捷记录</strong><small>浏览器获得焦点时可模拟</small></span>
            <kbd>Ctrl Alt Space</kbd>
          </div>
          <div className="settings-row">
            <Gauge />
            <span><strong>剩余用量</strong><small>真实 AI 尚未接入，没有实际调用或费用</small></span>
            <em>尚未接入</em>
          </div>
          <div className="settings-row">
            <Sparkles />
            <span><strong>界面动效</strong><small>将在下一轮统一实现，并跟随系统减少动态效果</small></span>
            <em>待实现</em>
          </div>
          <div className="settings-row">
            <Archive />
            <span><strong>本地数据</strong><small>当前仍为演示数据，刷新后恢复初始内容</small></span>
            <em>演示</em>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function QuickCapture({ onClose, onSave }: { onClose: () => void; onSave: (title: string, attachment: boolean) => void }) {
  const [title, setTitle] = useState("")
  const [attachment, setAttachment] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const paste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    event.preventDefault()
    setAttachment(URL.createObjectURL(file))
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="capture-modal">
        <div className="modal-heading compact">
          <div className="capture-mark"><Command /></div>
          <div>
            <h2>先记下来</h2>
            <p>不用现在整理，回车后立刻回到原来的工作。</p>
          </div>
          <button onClick={onClose} aria-label="关闭"><X /></button>
        </div>
        <textarea
          ref={inputRef}
          value={title}
          placeholder="你现在在想什么？"
          rows={3}
          onPaste={paste}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (title.trim()) onSave(title.trim(), Boolean(attachment))
            }
          }}
        />
        {attachment && (
          <div className="attachment-preview">
            <img src={attachment} alt="粘贴图片预览" />
            <div><Image /><span>已接住剪贴板图片</span></div>
            <button onClick={() => setAttachment(null)}><X /></button>
          </div>
        )}
        <div className="capture-footer">
          <span><Image /> 可直接粘贴截图</span>
          <div>
            <span><kbd>Shift</kbd> + <kbd>Enter</kbd> 换行</span>
            <Button disabled={!title.trim()} onClick={() => onSave(title.trim(), Boolean(attachment))}>
              保存到收集箱 <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function AiBreakdown({ task, onClose, onApply }: { task: Task; onClose: () => void; onApply: (steps: string[]) => void }) {
  const [stage, setStage] = useState<"scope" | "loading" | "result">("scope")
  const [useMemory, setUseMemory] = useState(true)
  const [feedback, setFeedback] = useState("")
  const [appliedFeedback, setAppliedFeedback] = useState("")
  const [isRefining, setIsRefining] = useState(false)
  const baseResult = [
    task.title.includes("周报") ? "打开上周周报模板，复制一份并改成今天的日期" : `打开与“${task.title}”有关的材料，先放到同一个窗口里`,
    "写下这件事最终要交付的一个结果",
    "只处理最容易确认的一小部分",
  ]
  const feedbackSummary = appliedFeedback.length > 28 ? `${appliedFeedback.slice(0, 28)}…` : appliedFeedback
  const result = appliedFeedback
    ? [
        `针对“${feedbackSummary}”，先把任务缩小成一个 5 分钟内能验证的动作`,
        "确认反馈里最影响开始的一个限制",
        "完成最小动作后，再决定是否继续原计划",
      ]
    : baseResult

  const run = (feedbackText = "") => {
    const trimmedFeedback = feedbackText.trim()
    setIsRefining(Boolean(trimmedFeedback))
    setAppliedFeedback(trimmedFeedback)
    setStage("loading")
    window.setTimeout(() => {
      setStage("result")
      if (trimmedFeedback) setFeedback("")
    }, 900)
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="modal-heading">
        <div className="ai-icon large"><Brain /></div>
        <div>
          <div className="eyebrow">AI 第一步 · 演示</div>
          <h2>{stage === "result" ? "先从这一小步开始" : isRefining ? "根据你的反馈重新拆解" : "让任务变得容易启动"}</h2>
          <p>{task.title}</p>
        </div>
        <button onClick={onClose} aria-label="关闭"><X /></button>
      </div>

      {stage === "scope" && (
        <div className="ai-scope">
          <div className="scope-card">
            <div><CheckCircle2 /><strong>本次会发送</strong></div>
            <p>当前任务标题、备注和已经存在的步骤</p>
          </div>
          <button className={useMemory ? "memory-toggle active" : "memory-toggle"} onClick={() => setUseMemory((value) => !value)}>
            <div><Brain /><span><strong>使用 3 条相关记忆</strong><small>例如你习惯先找模板、先确认交付对象</small></span></div>
            <span className="switch"><i /></span>
          </button>
          <p className="privacy-note">这是界面演示，不会真的上传任何内容。接入 DeepSeek 后，每次都会先显示发送范围。</p>
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button aria-label="开始拆解" onClick={() => run()}><Sparkles /> 拆解</Button>
          </div>
        </div>
      )}

      {stage === "loading" && (
        <div className="ai-loading">
          <div className="thinking-orbit"><Sparkles /></div>
          <h3>{isRefining ? "正在根据反馈重新拆解" : "正在找最小的启动动作"}</h3>
          <p>{isRefining ? "会保留原任务，只调整建议的第一步和后续顺序。" : "不是把任务拆得更复杂，而是找到你现在就能做的第一步。"}</p>
        </div>
      )}

      {stage === "result" && (
        <div className="ai-result">
          {appliedFeedback && (
            <div className="feedback-applied">
              <RotateCcw />
              <span><strong>已根据你的反馈重新拆解</strong><small>{appliedFeedback}</small></span>
            </div>
          )}
          <div className="first-step-card">
            <span>建议第一步 · 约 5 分钟</span>
            <h3>{result[0]}</h3>
            <p>完成这一小步以后，再决定要不要继续，不要求现在做完整件事。</p>
          </div>
          <div className="later-steps">
            <span>后面再做</span>
            {result.slice(1).map((step, index) => <p key={step}><i>{index + 2}</i>{step}</p>)}
          </div>
          <div className="ai-feedback">
            <label htmlFor="ai-feedback-input">结果不合适？告诉 AI 哪里需要调整</label>
            <Textarea
              id="ai-feedback-input"
              aria-label="给 AI 的调整反馈"
              value={feedback}
              placeholder="例如：这一步还是太大，我想先从收集资料开始"
              onChange={(event) => setFeedback(event.target.value)}
            />
            <div>
              <span>只会重新生成建议，不会修改原任务。</span>
              <Button variant="outline" aria-label="根据反馈重新拆解" disabled={!feedback.trim()} onClick={() => run(feedback)}>
                <RotateCcw /> 重拆
              </Button>
            </div>
          </div>
          <div className="modal-actions split">
            <Button variant="outline" onClick={() => {
              setAppliedFeedback("")
              setFeedback("")
              setIsRefining(false)
              setStage("scope")
            }}><ArrowLeft /> 上一步</Button>
            <Button aria-label="采用这个第一步" onClick={() => onApply(result)}><Check /> 采用</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function TomorrowPlanner({ tasks, onClose, onApply }: { tasks: Task[]; onClose: () => void; onApply: (ids: number[]) => void }) {
  const [selected, setSelected] = useState<number[]>(tasks.filter((task) => task.plannedDate === "明天").map((task) => task.id))
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <Modal onClose={onClose} wide>
      <div className="modal-heading">
        <div className="planner-icon"><CalendarDays /></div>
        <div><div className="eyebrow">明天 · 8 月 6 日</div><h2>明天先做什么？</h2><p>建议不超过 7 件，给临时任务留一点空间。</p></div>
        <button onClick={onClose} aria-label="关闭"><X /></button>
      </div>
      <div className="planner-body">
        <div className="planner-count"><strong>{selected.length}</strong><span>件已安排</span><small>{selected.length > 7 ? "有点多，考虑移走几件" : "负担看起来还可以"}</small></div>
        <div className="planner-list">
          {tasks.map((task) => (
            <button key={task.id} className={selected.includes(task.id) ? "planner-task selected" : "planner-task"} onClick={() => toggle(task.id)}>
              <span className="planner-check">{selected.includes(task.id) && <Check />}</span>
              <span><strong>{task.title}</strong><small>{task.project}{task.dueLabel ? ` · ${task.dueLabel}` : ""}</small></span>
            </button>
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button onClick={() => onApply(selected)}>确认明日计划 <ArrowRight /></Button>
      </div>
    </Modal>
  )
}

export default App
