import { writeFileSync } from "node:fs"

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222"
const pages = await fetch(`${endpoint}/json`).then((response) => response.json())
const page = pages.find((item) => item.type === "page" && item.url.includes("127.0.0.1:4173"))

if (!page) {
  throw new Error("没有找到 OneStep 浏览器页面")
}

const socket = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
let requestId = 0

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(message.error.message))
  else resolve(message.result)
})

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", reject, { once: true })
})

function send(method, params = {}) {
  const id = ++requestId
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

await send("Runtime.enable")
await send("Page.enable")
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})
await send("Page.reload", { ignoreCache: true })
await new Promise((resolve) => setTimeout(resolve, 500))
const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-main.png", import.meta.url), Buffer.from(screenshot.data, "base64"))
await send("Runtime.evaluate", {
  expression: '[...document.querySelectorAll(".nav-item")].find((button) => button.textContent.includes("收集箱"))?.click()',
})
await new Promise((resolve) => setTimeout(resolve, 160))
const inboxScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-inbox.png", import.meta.url), Buffer.from(inboxScreenshot.data, "base64"))
await send("Page.reload", { ignoreCache: true })
await new Promise((resolve) => setTimeout(resolve, 400))
const evaluation = await send("Runtime.evaluate", {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const result = {};
    result.mainVisible = Boolean(document.querySelector(".app-shell") && document.querySelector(".workspace") && document.querySelector(".detail-panel"));
    const primaryAction = [...document.querySelectorAll("button")].find((button) => button.textContent.includes("记下一件事"));
    result.primaryActionVisible = Boolean(primaryAction && getComputedStyle(primaryAction).color === "rgb(255, 255, 255)");
    result.sidebarDuplicateRemoved = !document.body.innerText.includes("快速记录");
    result.detailPlaceholderMenuRemoved = !document.querySelector('button[aria-label="更多操作"]');

    document.querySelector('button[aria-label="打开账户菜单"]')?.click();
    await wait(80);
    result.profileMenuOpened = Boolean(document.querySelector('.profile-menu')) && document.body.innerText.includes("剩余用量") && document.body.innerText.includes("尚未接入");
    document.querySelector('button[aria-label="配置 AI 接口"]')?.click();
    await wait(80);
    result.apiSettingsOpened = Boolean(document.querySelector('.api-settings-modal'))
      && document.body.innerText.includes("供应商")
      && document.body.innerText.includes("请求地址")
      && document.body.innerText.includes("API Key");
    [...document.querySelectorAll('.provider-options button')].find((button) => button.textContent.includes("自定义"))?.click();
    const apiInputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const apiValues = [
      ['input[aria-label="AI 请求地址"]', "https://example.invalid/v1"],
      ['input[aria-label="AI 模型名称"]', "demo-model"],
      ['input[aria-label="AI API Key"]', "sk-test-not-sent"],
    ];
    for (const [selector, value] of apiValues) {
      const input = document.querySelector(selector);
      apiInputSetter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await wait(80);
    document.querySelector('button[aria-label="保存 AI 接口配置"]')?.click();
    await wait(80);
    document.querySelector('button[aria-label="打开账户菜单"]')?.click();
    await wait(80);
    result.apiSettingsSaved = Boolean(document.querySelector('.profile-menu'))
      && document.querySelector('.usage-summary')?.textContent.includes("已配置");
    [...document.querySelectorAll('.profile-menu button')].find((button) => button.textContent.includes("设置"))?.click();
    await wait(80);
    result.settingsModalOpened = Boolean(document.querySelector('.settings-modal')) && document.body.innerText.includes("快捷记录") && document.body.innerText.includes("本地数据");
    const shortcutButton = document.querySelector('input[aria-label="快捷记录组合键"]');
    shortcutButton?.click();
    await wait(60);
    shortcutButton?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    }));
    await wait(80);
    result.shortcutCustomized = shortcutButton?.value.includes("Ctrl + Shift + K");
    document.querySelector('button[aria-label="关闭设置"]')?.click();
    await wait(80);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    }));
    await wait(80);
    result.customShortcutOpened = Boolean(document.querySelector('.capture-modal'));
    document.querySelector('.capture-modal button[aria-label="关闭"]')?.click();
    await wait(80);

    document.querySelector(".detail-close")?.click();
    await wait(80);
    result.detailClosed = !document.querySelector(".detail-panel") && document.querySelector(".app-shell")?.classList.contains("detail-closed");
    document.querySelector(".task-row")?.click();
    await wait(80);
    result.detailReopened = Boolean(document.querySelector(".detail-panel"));

    document.querySelector(".schedule-trigger")?.click();
    await wait(80);
    result.plannedDatePickerOpened = Boolean(document.querySelector(".schedule-menu")) && document.body.innerText.includes("选择具体日期") && document.body.innerText.includes("以后再做");
    const dateInput = document.querySelector('input[aria-label="选择具体计划日期"]');
    const dateSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    dateSetter.call(dateInput, "2026-08-12");
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(100);
    result.customPlannedDateApplied = document.querySelector(".schedule-trigger")?.textContent.includes("8 月 12 日") && !document.querySelector(".schedule-menu");

    document.querySelector('button[aria-label="设置截止时间"]')?.click();
    await wait(80);
    result.deadlinePickerOpened = Boolean(document.querySelector(".datetime-picker:not(.align-right) .wheel-popover")) && document.body.innerText.includes("设置截止时间");
    const deadlinePicker = document.querySelector(".datetime-picker:not(.align-right)");
    deadlinePicker.querySelector('button[aria-label="展开截止时间日期"]')?.click();
    await wait(60);
    deadlinePicker.querySelector('button[aria-label="截止时间日期 2026-08-15"]')?.click();
    await wait(60);
    const deadlineWheels = deadlinePicker.querySelectorAll(".wheel-column");
    [...deadlineWheels[0].querySelectorAll("button")].find((button) => button.textContent.trim() === "18")?.click();
    [...deadlineWheels[1].querySelectorAll("button")].find((button) => button.textContent.trim() === "37")?.click();
    await wait(120);
    deadlinePicker.querySelector(".wheel-popover button[data-slot='button']")?.click();
    await wait(80);
    result.deadlineApplied = document.querySelector('button[aria-label="设置截止时间"]')?.textContent.includes("2026/08/15 18:37");

    document.querySelector('button[aria-label="设置提醒时间"]')?.click();
    await wait(80);
    result.reminderPickerOpened = Boolean(document.querySelector(".datetime-picker.align-right .wheel-popover")) && document.body.innerText.includes("设置提醒时间");
    const reminderPicker = document.querySelector(".datetime-picker.align-right");
    reminderPicker.querySelector('button[aria-label="展开提醒时间日期"]')?.click();
    await wait(60);
    reminderPicker.querySelector('button[aria-label="提醒时间日期 2026-08-15"]')?.click();
    await wait(60);
    const reminderWheels = reminderPicker.querySelectorAll(".wheel-column");
    [...reminderWheels[0].querySelectorAll("button")].find((button) => button.textContent.trim() === "17")?.click();
    [...reminderWheels[1].querySelectorAll("button")].find((button) => button.textContent.trim() === "11")?.click();
    await wait(120);
    reminderPicker.querySelector(".wheel-popover button[data-slot='button']")?.click();
    await wait(80);
    result.reminderApplied = document.querySelector('button[aria-label="设置提醒时间"]')?.textContent.includes("2026/08/15 17:11");

    document.querySelector('button[aria-label="设置项目"]')?.click();
    await wait(80);
    result.customProjectOpened = Boolean(document.querySelector(".project-picker .project-menu")) && !document.querySelector(".detail-panel select");
    [...document.querySelectorAll(".project-picker .project-menu button")].find((button) => button.textContent.includes("招聘推进"))?.click();
    await wait(80);
    result.customProjectApplied = document.querySelector('button[aria-label="设置项目"]')?.textContent.includes("招聘推进");

    document.querySelector('button[aria-label="设置重复方式"]')?.click();
    await wait(80);
    result.repeatPickerOpened = Boolean(document.querySelector(".repeat-menu")) && document.body.innerText.includes("每天重复");
    [...document.querySelectorAll(".repeat-menu button")].find((button) => button.textContent.includes("每天重复"))?.click();
    await wait(80);
    result.repeatApplied = document.querySelector('button[aria-label="设置重复方式"]')?.textContent.includes("每天重复");

    document.querySelector(".quadrant-selector button.active")?.click();
    await wait(100);
    result.quadrantDeselected = document.querySelector(".workspace-header h1")?.textContent === "收集箱" && !document.querySelector(".quadrant-selector button.active") && document.body.innerText.includes("已取消象限选择，任务回到收集箱");

    [...document.querySelectorAll(".nav-item")].find((button) => button.textContent.includes("已完成"))?.click();
    await wait(100);
    result.completedViewOpened = Boolean(document.querySelector(".inline-restore")) && document.body.innerText.includes("提交本周考勤确认");
    document.querySelector(".inline-restore")?.click();
    await wait(100);
    result.completedRestored = document.querySelector(".workspace-header h1")?.textContent === "已完成"
      && !document.body.innerText.includes("提交本周考勤确认")
      && document.body.innerText.includes("已恢复到今天");
    [...document.querySelectorAll(".nav-item")].find((button) => button.textContent.includes("今天"))?.click();
    await wait(80);
    document.querySelector(".task-row")?.click();
    await wait(80);

    document.querySelector(".sidebar-label button")?.click();
    await wait(60);
    const newProjectInput = document.querySelector('input[aria-label="新项目名称"]');
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    inputSetter.call(newProjectInput, "实习项目");
    newProjectInput.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(50);
    document.querySelector('button[aria-label="保存新项目"]')?.click();
    await wait(100);
    result.projectAdded = [...document.querySelectorAll(".project-nav .nav-item")].some((button) => button.textContent.includes("实习项目"));

    const workProject = [...document.querySelectorAll(".project-nav .nav-item")].find((button) => button.textContent.includes("工作事务"));
    workProject?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await wait(80);
    const renameInput = document.querySelector('input[aria-label="重命名工作事务"]');
    result.projectRenameSelected = Boolean(renameInput && renameInput.selectionStart === 0 && renameInput.selectionEnd === "工作事务".length);
    inputSetter.call(renameInput, "工作任务");
    renameInput.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(50);
    renameInput.blur();
    await wait(100);
    result.projectRenamed = document.body.innerText.includes("工作任务") && ![...document.querySelectorAll(".project-nav .nav-item")].some((button) => button.textContent.includes("工作事务"));

    primaryAction?.click();
    await wait(80);
    result.captureOpened = document.body.innerText.includes("先记下来") && document.querySelector(".capture-modal textarea")?.placeholder === "你现在在想什么？";

    const textarea = document.querySelector(".capture-modal textarea");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, "演示：确认明天会议资料");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(80);
    [...document.querySelectorAll("button")].find((button) => button.textContent.includes("保存到收集箱"))?.click();
    await wait(120);
    result.captureSaved = document.body.innerText.includes("演示：确认明天会议资料") && document.body.innerText.includes("已接住");

    document.querySelector(".ai-entry")?.click();
    await wait(80);
    result.aiScopeOpened = document.body.innerText.includes("让任务变得容易启动") && document.body.innerText.includes("本次会发送");
    document.querySelector('button[aria-label="开始拆解"]')?.click();
    await wait(1100);
    result.aiResultShown = document.body.innerText.includes("先从这一小步开始") && Boolean(document.querySelector('button[aria-label="采用这个第一步"]'));
    const feedbackInput = document.querySelector('textarea[aria-label="给 AI 的调整反馈"]');
    setter.call(feedbackInput, "第一步还是太大，我想先从收集资料开始");
    feedbackInput.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(80);
    document.querySelector('button[aria-label="根据反馈重新拆解"]')?.click();
    await wait(1100);
    result.aiFeedbackApplied = document.body.innerText.includes("已根据你的反馈重新拆解") && document.body.innerText.includes("第一步还是太大，我想先从收集资料开始");
    document.querySelector('button[aria-label="采用这个第一步"]')?.click();
    await wait(100);
    result.aiApplied = document.body.innerText.includes("当前第一步");
    document.querySelector('button[aria-label="撤销 AI 拆解"]')?.click();
    await wait(100);
    result.aiUndoApplied = document.body.innerText.includes("已撤销 AI 拆解") && !document.body.innerText.includes("当前第一步");

    [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "安排明天")?.click();
    await wait(80);
    result.tomorrowOpened = document.body.innerText.includes("明天先做什么？") && document.body.innerText.includes("件已安排");
    return result;
  })()`,
})

if (evaluation.exceptionDetails || evaluation.result?.subtype === "error") {
  throw new Error(`交互脚本执行异常：${evaluation.exceptionDetails?.text ?? evaluation.result?.description ?? "未知错误"}`)
}
const result = evaluation.result?.value
if (!result || Object.keys(result).length === 0) {
  throw new Error("交互脚本没有返回检查结果")
}
console.log(JSON.stringify(result, null, 2))
const failed = Object.entries(result).filter(([, value]) => value !== true)

await send("Page.reload", { ignoreCache: true })
await new Promise((resolve) => setTimeout(resolve, 400))
await send("Runtime.evaluate", { expression: 'document.querySelector(".schedule-trigger")?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
const plannedDateScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-planned-date-picker.png", import.meta.url), Buffer.from(plannedDateScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(".schedule-trigger")?.click()' })
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="设置截止时间"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
const deadlineScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-deadline-picker.png", import.meta.url), Buffer.from(deadlineScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="设置截止时间"]\')?.click(); document.querySelector(\'button[aria-label="设置提醒时间"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="展开提醒时间日期"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
const reminderScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-reminder-wheel.png", import.meta.url), Buffer.from(reminderScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="设置提醒时间"]\')?.click(); document.querySelector(\'button[aria-label="设置项目"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
const projectScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-project-picker.png", import.meta.url), Buffer.from(projectScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="设置项目"]\')?.click(); document.querySelector(\'button[aria-label="设置重复方式"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
const repeatScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-repeat-picker.png", import.meta.url), Buffer.from(repeatScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="设置重复方式"]\')?.click(); document.querySelector(\'button[aria-label="打开账户菜单"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
const profileMenuScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-profile-menu.png", import.meta.url), Buffer.from(profileMenuScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="配置 AI 接口"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
const apiSettingsScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-api-settings.png", import.meta.url), Buffer.from(apiSettingsScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="关闭 AI 接口设置"]\')?.click(); document.querySelector(\'button[aria-label="打开账户菜单"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
await send("Runtime.evaluate", { expression: '[...document.querySelectorAll(".profile-menu button")].find((button) => button.textContent.includes("设置"))?.click()' })
await new Promise((resolve) => setTimeout(resolve, 120))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'input[aria-label="快捷记录组合键"]\')?.click()' })
await new Promise((resolve) => setTimeout(resolve, 80))
const settingsScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-settings.png", import.meta.url), Buffer.from(settingsScreenshot.data, "base64"))
await send("Runtime.evaluate", { expression: 'document.querySelector(\'button[aria-label="关闭设置"]\')?.click()' })
await send("Runtime.evaluate", { expression: 'document.querySelector(".detail-close")?.click()' })
await new Promise((resolve) => setTimeout(resolve, 220))
const collapsedScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-detail-collapsed.png", import.meta.url), Buffer.from(collapsedScreenshot.data, "base64"))
await send("Page.reload", { ignoreCache: true })
await new Promise((resolve) => setTimeout(resolve, 400))
await send("Runtime.evaluate", {
  expression: '[...document.querySelectorAll(".nav-item")].find((button) => button.textContent.includes("四象限"))?.click()',
})
await new Promise((resolve) => setTimeout(resolve, 160))
const quadrantScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-quadrants.png", import.meta.url), Buffer.from(quadrantScreenshot.data, "base64"))
await send("Page.reload", { ignoreCache: true })
await new Promise((resolve) => setTimeout(resolve, 400))
await send("Runtime.evaluate", {
  expression: '[...document.querySelectorAll(".project-nav .nav-item")].find((button) => button.textContent.includes("工作事务"))?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))',
})
await new Promise((resolve) => setTimeout(resolve, 120))
const renameScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-project-rename.png", import.meta.url), Buffer.from(renameScreenshot.data, "base64"))
await send("Page.reload", { ignoreCache: true })
await new Promise((resolve) => setTimeout(resolve, 400))
await send("Runtime.evaluate", {
  expression: '[...document.querySelectorAll("button")].find((button) => button.textContent.includes("记下一件事"))?.click()',
})
await new Promise((resolve) => setTimeout(resolve, 120))
const captureScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-capture.png", import.meta.url), Buffer.from(captureScreenshot.data, "base64"))
await send("Page.reload", { ignoreCache: true })
await new Promise((resolve) => setTimeout(resolve, 400))
await send("Runtime.evaluate", {
  awaitPromise: true,
  expression: `(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    document.querySelector(".ai-entry")?.click();
    await wait(100);
    document.querySelector('button[aria-label="开始拆解"]')?.click();
    await wait(1050);
    const input = document.querySelector('textarea[aria-label="给 AI 的调整反馈"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, "第一步还是太大，我想先从收集资料开始");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(80);
    document.querySelector('button[aria-label="根据反馈重新拆解"]')?.click();
    await wait(1050);
  })()`,
})
const aiFeedbackScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-ai-feedback.png", import.meta.url), Buffer.from(aiFeedbackScreenshot.data, "base64"))
await send("Runtime.evaluate", {
  expression: `document.querySelector('button[aria-label="采用这个第一步"]')?.click()`,
})
await new Promise((resolve) => setTimeout(resolve, 120))
const detailRhythmScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync(new URL("../artifacts/onestep-detail-rhythm.png", import.meta.url), Buffer.from(detailRhythmScreenshot.data, "base64"))
socket.close()

if (failed.length > 0) {
  throw new Error(`交互检查失败：${failed.map(([key]) => key).join(", ")}`)
}
