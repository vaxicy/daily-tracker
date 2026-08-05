# 新增日语 (ja) 与韩语 (ko) 多语言操作手册

> 目标：在现有 `zh / en / es` 三语基础上，再新增 `ja`（日本語）和 `ko`（한국어），做到语言全覆盖、无代码错误、无缺失 key 回退成英文 key 字符串。
>
> 适用范围：本项目 `daily-tracker` 扩展（MV3，i18n 走自建 `I18N` 字典，无 `_locales`）。
>
> 本文档为「先睡觉、明天照做」而写，步骤可直接复制执行。

---

## 0. 开始前必读：之前踩过的坑（务必吸取）

1. **批量改 JS 对象字面量漏逗号 → 整个文件解析失败 → popup 全白**
   - 之前在 `themes.js` 给 24 个主题批量插属性，脚本只拼接没补前一行逗号，导致 `themes.js` 加载失败、popup 全白。
   - 本次在 `i18n.js` 的 `I18N` 对象里**新增 `ja:` / `ko:` 整段**，是新增顶层键，不会破坏已有 `zh/en/es`，风险低。但**每一行末尾的逗号都要写对**：对象内最后一个键值对**不能**有逗号（JS 允许尾逗号，但为保险请保持一致风格——本项目现有写法每行都有逗号，且最后一个键后无逗号）。
   - **改完必须用 Node 验证**：见第 5 步。

2. **key 缺失 → 显示成 key 字符串本身**（最隐蔽的"代码错误"）
   - `t(key)` 找不到时返回 `key` 本身。例如漏了 `drinkBtn` 的 ja 翻译，日语界面就会显示 `drinkBtn` 这串英文字母。
   - 因此 **ja / ko 的 key 集合必须和 zh 的 key 全集完全对齐**（es 是精简集，不要以 es 为准）。

3. **语言切换要覆盖所有动态区域**
   - 语言下拉目前是硬编码三元判断（zh/en/es），新增语言必须同步改 popup.js 里 3 处，否则下拉里看不到 ja/ko、或切换后某处仍残留旧语言。

4. **`getLocale()` / `loadLanguage()` 必须加分支**
   - 否则 ja/ko 环境下 `toLocaleDateString` 等会错乱，且自动识别不认得日语/韩语浏览器。

---

## 1. 涉及文件清单

| 文件 | 改动 |
|------|------|
| `i18n.js` | 在 `I18N` 对象新增 `ja: {...}`、`ko: {...}` 两段完整翻译 |
| `i18n.js` | `getLocale()` 增加 ja→`ja-JP`、ko→`ko-KR` 分支 |
| `i18n.js` | `loadLanguage()` 自动识别增加 `startsWith("ja")` / `startsWith("ko")` |
| `popup.js` | 语言下拉列表（约 4908 行）增加 ja/ko 两项 |
| `popup.js` | `currentLang` 三元判断（约 4940、5004 行）改为支持 ja/ko |
| `popup.html` | （通常不用改）检查语言按钮的 `data-i18n` 是否够，一般已有 |

> 只有 `i18n.js` 和 `popup.js` 需要动。manifest、background、themes 都不用改。

---

## 2. 第 1 步：i18n.js 新增 ja / ko 翻译段

### 2.1 位置
在 `i18n.js` 第 3 行 `zh: {` 之前、或在 `es: {...}` 结束（第 1242 行 `}`）之后、**`};`（第 1243 行）之前**，插入两整段。

推荐：插在 `es: {...},` 之后、`};` 之前，结构清晰。

### 2.2 格式模板（照抄，把文案填进去）

```js
  ja: {
    // 结构与 zh 完全一致，下同。以下仅列关键 key，需补全 zh 的全部 key
    appName: "Daily Habit Tracker",
    appDesc: "食事・水分・排便・排尿を記録する健康習慣トラッカー。",
    // ... 其余 key 全部按 zh 的 key 名逐条翻译 ...
  },
  ko: {
    appName: "Daily Habit Tracker",
    appDesc: "식사·수분·배변·배뇨를 기록하는 건강 습관 트래커.",
    // ... 其余 key 全部按 zh 的 key 名逐条翻译 ...
  },
```

### 2.3 必须 100% 覆盖的 key（以 zh 为基准，共约 300+ 个 key）

**最关键：先拿 zh 段的全部 key 名**（第 3–419 行），逐条在 ja/ko 里都写一遍。重点分组清单：

- 通用：`appName appDesc healthyTracker settings close`
- 饮食：`eatTitle eatSub eatPlaceholder remarkPlaceholder ratingLabel ratingNone ratingTexts(数组10) fullnessLevels(数组5) mealTags(数组16) mealTagEmojis(数组16) eatWeek eatMonth eatStatAvgRating eatStatStreak eatStatTypeDist fullnessLabel fullnessHungry fullnessJustRight fullnessStuffed autoTagHint eatStatTotal eatStatDays addMeal todayMeals itemCount noMeal breakfast lunch dinner snack edit delete save cancel confirmDelete customTag addCustomTag chooseEmoji tagName tagNamePlaceholder tagNameRequired emojiRequired tagNameTooLong tagExists tagAdded confirm confirmTitle reminderTitle addReminder editReminder reminderLabel reminderLabelPlaceholder reminderIcon reminderTimes addTime reminderEnabled remindAt noReminders reminderAdded reminderUpdated reminderDeleted reminderTest confirmDeleteReminder reminderLabelRequired reminderTimeRequired`
- 喝水：`drinkTitle drinkSub drinkBtn resetTimer notifEnabled notifDisabled testNotif intervalLabel customInterval customApply today week month drinkRecord adjustDrink drinkLabel drinkTimerLabel drinkNotifLabel interval15 interval30 interval45 interval60 unitSeconds unitMinutes unitHours drinkLegendLess drinkLegendMore wdSun wdMon wdTue wdWed wdThu wdFri wdSat`
- 拉屎：`poopTitle poopSub poopCheckin poopRemarkPlaceholder todayPoop times bristolTypes(数组7) bristolDescs(数组7) bristolMainLabel bristolMainDesc noPoop poopWeek poopMonth poopRecord bristolPrefix poopAmounts(数组5) poopAmountLabel poopColors(数组7) poopColorLabel poopColorNotSelected bristolTypeLabel weekTotal monthTotal idealCount hardCount softCount idealRatio consecutiveIdeal statsTitle`
- 撒尿：`peeTitle peeSub peeCheckin peeRemarkPlaceholder todayPee peeWeek peeMonth noPee peeRecord peeAmounts(数组5) peeAmountLabel peeColors(数组6) peeColorLabel dailyAvg maxInterval minInterval`
- 经期：`periodTitle periodSub periodStart periodActive periodActiveShort periodEnd periodEndConfirm periodMoodLabel periodMoods(数组5) periodMoodEmojis(数组5) periodPainLabel periodPainLevels(数组6) periodPainEmojis(数组6) periodSymptomsLabel periodSymptoms(数组6) periodSymptomEmojis(数组6) periodFlowLabel periodFlowLevels(数组6) periodFlowEmojis(数组6) periodRemarkPlaceholder periodBloodColorLabel periodBloodColors(数组5) periodDaySaved periodSelectDay periodUnsavedConfirm periodPleaseSaveFirst periodNoRecord periodDelete periodDeleteConfirm periodDeleted periodTotalCycles periodAvgCycle periodCycleAbnormal periodAvgDuration periodDurationAbnormal periodCycleTableTitle periodStatsTitle periodCycleTableSeq periodCycleTableStart periodCycleTableCycleLen periodCycleTableDuration periodDay periodAbnormalCount periodToggleLabel periodStatusOff periodStatusOn periodClearDay periodNoDataToClear periodClearConfirm periodDayCleared periodBarChartTitle periodBarChartLegendCycle periodBarChartLegendDuration periodBarChartLegendAvg periodBarChartDay periodClearCycle periodClearCycleConfirm periodCycleCleared periodBackdateConfirm periodDateInCycle periodBackdateHint periodNotSelected`
- 设置：`funcSettings badgeSettings badgeToggle badgeContent badgeOptDrinkToday badgeOptDrinkWeek badgeOptDrinkMonth badgeOptPoopToday badgeOptPoopWeek badgeOptPoopMonth badgeOptPeeToday badgeOptPeeWeek badgeOptPeeMonth badgeOptMealToday badgeOptMealWeek badgeOptMealMonth eatModule drinkModule poopModule peeModule periodModule defaultPage themeStyle themeDefault themePink themeDark themeForest language langZh langEn langEs donateTitle donateDesc donateBtn donateQrTitle donateQrTip backupExport backupImport backupTip feedbackTitle feedbackDesc feedbackBtn backupExportTip backupImportTip backupExportSuccess backupImportSuccess backupImportConfirm backupImportInvalid`
- 通知：`notifTitle notifBody notifDrank notifSkip`
- Toast：`toastDrinkRecorded toastDrinkReset toastNotifOn toastNotifOff toastDefaultPage toastDrinkAdded toastDrinkRemoved toastPoopRecorded toastPeeRecorded toastMealAdded toastMealDeleted toastPeriodRecorded toastRemarkSynced toastInputMeal toastInputEmpty toastEditSuccess toastDeleteSuccess toastTimerOn toastTimerOff toastNotifApiUnavailable toastNotifUnavailable confirmDeleteMeal confirmDeleteRecord makeUpCheckin toastDrinkResetTimer toastStartTimerFirst toastTimerReset toastIntervalUpdated toastInvalidTime toastCustomIntervalApplied toastNoRecordToday toastUndoSuccess undoLast weekTotal monthTotal tooltipEmptyMeal tooltipEmptyRecord defaultTime customTime applyDefaultTime mealDefaultTimesTitle breakfastTime lunchTime dinnerTime snackTime rateLabelShort modifyRecordTime toastSettingsSaved addRecordBtn makeUpCheckinBtn checkinSuccess makeUpCheckinSuccess futureDateNotAllowed yearMonth dateDisplay timerRunning timerNotRunning timerHintOff notifOn notifOff remindEveryHour remindEveryMin remindEverySec noDrinkRecord noDrinkRecordToday addOneDrink drinkRemarkPlaceholder noPoopRecord noPeeRecord editTitle deleteTitle appendRecordBtn mealRemarkLabel themeDefaultName themePinkName themeDarkName themeForestName themeSageName themeOatName themeLotusName themeHarvestName themeAuroraName themeVermilionName themeVineName themeMistyName themeEvenglowName themeJadeiteName themeSunsetHazeName themeParchmentName themeLemonName themeMacaronName themeLagoonName themeRoseName themeJellylilacName themeStarlilacName themeApplemintName themeXmasName toastThemeSwitched tabNameEat tabNameDrink tabNamePoop tabNamePee tabNamePeriod exportCsv csvTitle csvEat csvDrink csvPoop csvPee csvPeriod csvExported csvNoData periodPredicted periodPredictRange moduleShown moduleHidden customIntervalPlaceholder drinkRange0 drinkRange1 drinkRange2 drinkRange3 drinkRange4 toastDefaultLang mealEditTitleSuffix mealCoreInfo mealExtraInfo poopEditTitleSuffix peeEditTitleSuffix noRemark saveEdit editRemarkPlaceholder remarkLabel editContentPlaceholder appendRecord`

> 注意：en 段末尾（第 794 行起）有**重复追加**的 key（`fullnessLevels` / `mealTags` 等数组又写了一遍），那是历史冗余。ja/ko **不需要重复**，每个 key 只写一次即可。

### 2.4 翻译注意点

- 数组长度必须和 zh 一致：`ratingTexts` 必须 10 个、`mealTags` 必须 16 个、`bristolTypes` 必须 7 个、`periodMoods` 必须 5 个、`periodSymptoms` 必须 6 个，否则界面数组下标错位。
- emoji 直接复用 zh 的，不要改。
- 含 `{num}` / `{time}` / `{n}` / `{y}` / `{m}` / `{d}` / `{page}` / `{lang}` / `{start}` / `{end}` / `{date}` 的占位符**照原样保留**，只翻译周围文字。例如 `drinkRecord: "Sip {num} · {time}"` 日语写成 `"{num}口目 · {time}"`。
- 日语/韩语里若用到 `'`（单引号）要转义成 `\'`；一般用双引号包裹字符串最稳。

---

## 3. 第 2 步：i18n.js 的 getLocale() 加分支

当前（第 1256–1260 行）：

```js
function getLocale() {
  if (currentLang === "zh") return "zh-CN";
  if (currentLang === "es") return "es-ES";
  return "en-US";
}
```

改为：

```js
function getLocale() {
  if (currentLang === "zh") return "zh-CN";
  if (currentLang === "es") return "es-ES";
  if (currentLang === "ja") return "ja-JP";
  if (currentLang === "ko") return "ko-KR";
  return "en-US";
}
```

---

## 4. 第 3 步：i18n.js 的 loadLanguage() 自动识别加分支

当前（第 1275–1278 行）：

```js
      currentLang = browserLang.startsWith("zh") ? "zh"
        : browserLang.startsWith("es") ? "es"
        : "en";
```

改为：

```js
      currentLang = browserLang.startsWith("zh") ? "zh"
        : browserLang.startsWith("ja") ? "ja"
        : browserLang.startsWith("ko") ? "ko"
        : browserLang.startsWith("es") ? "es"
        : "en";
```

> 顺序：ja/ko 放 es 之前，避免某些语言标签误命中。en 仍是兜底。

---

## 5. 第 4 步：popup.js 语言下拉与三元判断

### 5.1 下拉列表（约 4908–4910 行）

当前：

```js
    { id: "zh", label: t("langZh") },
    { id: "en", label: t("langEn") },
    { id: "es", label: t("langEs") },
```

改为（在 `i18n.js` 的 `langZh/langEn/langEs` 旁边补 `langJa` / `langKo` 两个 key 后）：

```js
    { id: "zh", label: t("langZh") },
    { id: "en", label: t("langEn") },
    { id: "es", label: t("langEs") },
    { id: "ja", label: t("langJa") },
    { id: "ko", label: t("langKo") },
```

并在 `i18n.js` 三套字典（zh/en/es 以及新 ja/ko）里都加这两个 key：
- zh: `langJa: "🇯🇵 日本語 Japanese"`, `langKo: "🇰🇷 한국어 Korean"`
- en: `langJa: "🇯🇵 日本語 Japanese"`, `langKo: "🇰🇷 한국어 Korean"`
- es: `langJa: "🇯🇵 日本語 Japanese"`, `langKo: "🇰🇷 한국어 Korean"`
- ja: `langJa: "🇯🇵 日本語"`, `langKo: "🇰🇷 한국어"`
- ko: `langJa: "🇯🇵 日本語"`, `langKo: "🇰🇷 한국어"`

### 5.2 currentLang 三元（约 4940 行）

当前：

```js
  const langName = lang === "zh" ? t("langZh") : lang === "es" ? t("langEs") : t("langEn");
```

改为：

```js
  const langName = lang === "zh" ? t("langZh")
    : lang === "ja" ? t("langJa")
    : lang === "ko" ? t("langKo")
    : lang === "es" ? t("langEs")
    : t("langEn");
```

### 5.3 初始化回填（约 5004 行）

当前：

```js
  if (lt) lt.textContent = t("lang" + (currentLang === "zh" ? "Zh" : currentLang === "es" ? "Es" : "En"));
```

改为：

```js
  const langSuffix = currentLang === "zh" ? "Zh"
    : currentLang === "ja" ? "Ja"
    : currentLang === "ko" ? "Ko"
    : currentLang === "es" ? "Es"
    : "En";
  if (lt) lt.textContent = t("lang" + langSuffix);
```

> 这三处都从「硬编码三元」改成支持 ja/ko，否则下拉里选了日语但按钮文字仍显示英语、或选了韩语下拉里根本没有这项。

---

## 6. 第 5 步：验证（必须做，避免重蹈漏逗号覆辙）

改完保存后，在 PowerShell 跑：

```powershell
cd "d:\迅雷下载\vibe coding\Chrome Extensions\daily-tracker"
node -e "require('./i18n.js'); console.log('i18n.js 加载成功')"
```

> 注意：`i18n.js` 用了 `const I18N = {...}` 顶层声明 + `chrome` API（`loadLanguage` 里）。`require` 在 Node 里没有 `chrome`，但 `require` 只解析不执行 `loadLanguage` 的回调，文件顶层没有立即调用 chrome，所以通常能过语法解析。若报 `chrome is not defined`，改用下方语法校验：

```powershell
node --check i18n.js
node --check popup.js
```

`--check` 只做语法解析、不执行，最稳。两者都应输出无错误。

### 6.1 key 对齐自检（强烈建议）

写一个临时脚本对比 ja/ko 是否覆盖了 zh 的全部 key（不进仓库，跑完删）：

```powershell
cd "d:\迅雷下载\vibe coding\Chrome Extensions\daily-tracker"
node -e "
const fs=require('fs');
const src=fs.readFileSync('i18n.js','utf8');
// 粗略提取 I18N 对象：用正则抓每段 key
function keysOf(block){ return [...block.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map(m=>m[1]); }
const seg = src.split(/^\s*(zh|en|es|ja|ko)\s*:\s*\{/m);
// 简单做法：直接用 vm 加载取真实对象
const vm=require('vm'); const ctx={chrome:{storage:{local:{get(){},set(){}}}}}; vm.createContext(ctx);
vm.runInContext(src+'\n;this.I18N=I18N;', ctx);
const zh=Object.keys(ctx.I18N.zh), ja=Object.keys(ctx.I18N.ja), ko=Object.keys(ctx.I18N.ko);
const missJa=zh.filter(k=>!ja.includes(k));
const missKo=zh.filter(k=>!ko.includes(k));
console.log('zh keys:', zh.length);
console.log('ja missing:', missJa.length, missJa);
console.log('ko missing:', missKo.length, missKo);
"
```

若 `ja missing` / `ko missing` 非空，补上对应 key 的翻译再验证。

---

## 7. 第 6 步：加载扩展验证

1. 打开 `chrome://extensions`，找到 Daily Tracker 点 **Reload**。
2. 打开 popup，点语言按钮，确认下拉出现「日本語」「한국어」两项。
3. 分别选日语、韩语，逐页（饮食/喝水/拉屎/撒尿/经期/设置）浏览，确认：
   - 没有显示成 `drinkBtn`、`eatTitle` 这类英文字母 key（即无缺失翻译）
   - 数组类（评分 10 级、餐次标签 16 个、Bristol 7 型）数量正常
   - 日历星期、日期格式正常
4. 若 Reload 后 popup 全白 → 立刻 `node --check i18n.js` 看是否漏逗号导致解析失败（回到第 6 步）。

---

## 8. 收尾（改完且验证通过后）

- git add / commit / push（如工作区有改动）。
- 弹 BurntToast 通知提醒「⚠ 需 Reload 扩展」。
- 写一条工作记忆：新增 ja/ko 双语、`I18N` 现 5 套字典、key 以 zh 为全集对齐。

---

## 9. 速查：最容易漏的 5 个点

1. `i18n.js` 新增 `ja:`/`ko:` 两段时，每段最后一个 key 后**不要**多写逗号（或保持与现有风格一致），且 `es` 段结束的 `},` 之后要正确接上新段。
2. `langJa` / `langKo` 两个 key 要在**全部 5 套字典**里都加（否则下拉标签显示 key 名）。
3. `getLocale()` 和 `loadLanguage()` 都要加 ja/ko 分支。
4. popup.js 三处三元（4908 / 4940 / 5004 行）都要扩成支持 ja/ko。
5. 改完必须 `node --check i18n.js` 且跑 key 对齐自检，确认无 missing。
