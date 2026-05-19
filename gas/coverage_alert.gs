// ============================================================
//  MEDIUM スタッフ不足アラート (Google Apps Script)
//
//  【セットアップ手順】
//  1. スクリプトエディタ → 「プロジェクトの設定」→「スクリプトプロパティ」に
//     以下を追加:
//       SUPABASE_URL  = https://tfkzsbwhvhgxbnnfwtou.supabase.co
//       SUPABASE_KEY  = (Supabase の anon key)
//       ALERT_TO      = 送信先メールアドレス（複数の場合はカンマ区切り）
//
//  2. 一度だけ setupDailyTrigger() を実行してトリガーを登録する
//     → 毎日 18:00 JST に checkCoverageAndAlert() が自動実行される
//
//  3. 初回実行時に「メール送信」「外部 URL アクセス」の権限を承認する
// ============================================================

// ── 設定 ────────────────────────────────────────────────────
const MIN_STAFF   = 2;      // これを下回ったらアラート
const WORK_START  = 9 * 60; // 09:00 (分)
const WORK_END    = 18 * 60; // 18:00 (分)
const TRIGGER_HOUR = 18;    // トリガー実行時刻 (JST)

// ステータス → 出勤時間帯のマッピング
const STATUS_RANGE = {
  MEDIUM_ALL:          [9 * 60, 18 * 60],
  AM_MEDIUM_PM_OTHER:  [9 * 60, 12 * 60],
  PM_MEDIUM_AM_OTHER:  [12 * 60, 18 * 60],
};

// ── メイン処理 ───────────────────────────────────────────────
function checkCoverageAndAlert() {
  const props    = PropertiesService.getScriptProperties();
  const baseUrl  = props.getProperty('SUPABASE_URL');
  const apiKey   = props.getProperty('SUPABASE_KEY');
  const alertTo  = props.getProperty('ALERT_TO');

  if (!baseUrl || !apiKey || !alertTo) {
    console.error('スクリプトプロパティが未設定です (SUPABASE_URL / SUPABASE_KEY / ALERT_TO)');
    return;
  }

  const tomorrow  = getTomorrowDate();
  const members   = fetchSupabase(baseUrl, apiKey, 'members', 'select=id,name&order=display_order');
  const schedules = fetchSupabase(baseUrl, apiKey, 'schedules',
    `select=member_id,status,gaps&date=eq.${tomorrow}`);

  if (!members || !schedules) {
    console.error('Supabase からのデータ取得に失敗しました');
    return;
  }

  // member_id → schedule のマップ
  const scheduleMap = {};
  schedules.forEach(s => { scheduleMap[s.member_id] = s; });

  // 1分単位でスタッフ数をカウント (540スロット: 9:00〜18:00)
  const TOTAL    = WORK_END - WORK_START;
  const presence = new Array(TOTAL).fill(0);

  members.forEach(member => {
    const entry = scheduleMap[member.id];
    if (!entry) return;

    const range = STATUS_RANGE[entry.status];
    if (!range) return; // ABSENT / 未設定 はスキップ

    const gaps = parseGaps(entry.gaps);

    for (let min = range[0]; min < range[1]; min++) {
      const inGap = gaps.some(g => min >= g.start && min < g.end);
      if (!inGap) presence[min - WORK_START]++;
    }
  });

  // MIN_STAFF 未満の連続時間帯を抽出
  const shortSlots = findUnderstaffedSlots(presence, TOTAL);

  if (shortSlots.length === 0) {
    console.log(`${tomorrow}: スタッフ ${MIN_STAFF} 名以上確保 → 送信なし`);
    return;
  }

  sendAlertEmail(alertTo, tomorrow, shortSlots, members, scheduleMap);
  console.log(`${tomorrow}: アラートメール送信 (不足時間帯 ${shortSlots.length} 件)`);
}

// ── カバレッジ不足スロット検出 ────────────────────────────────
function findUnderstaffedSlots(presence, total) {
  const slots = [];
  let start   = -1;

  for (let i = 0; i <= total; i++) {
    const short = i < total && presence[i] < MIN_STAFF;

    if (short && start === -1) {
      start = i;
    } else if (!short && start !== -1) {
      // このスロット中の最大人数を記録
      const maxCount = Math.max(...presence.slice(start, i));
      slots.push({
        startTime: minutesToTime(WORK_START + start),
        endTime:   minutesToTime(WORK_START + i),
        maxCount,
      });
      start = -1;
    }
  }

  return slots;
}

// ── メール送信 ───────────────────────────────────────────────
function sendAlertEmail(to, date, slots, members, scheduleMap) {
  const dateDisplay = date.replace(/-/g, '/');
  const dayOfWeek   = ['日', '月', '火', '水', '木', '金', '土'][new Date(date + 'T00:00:00+09:00').getDay()];

  const slotLines = slots.map(s => {
    const label = s.maxCount === 0 ? '（0人）' : `（最大 ${s.maxCount} 人）`;
    return `  ・${s.startTime}〜${s.endTime} ${label}`;
  }).join('\n');

  const memberLines = members.map(m => {
    const s = scheduleMap[m.id];
    return `  ・${m.name}: ${getStatusLabel(s ? s.status : null)}`;
  }).join('\n');

  const subject = `【MEDIUMアラート】${dateDisplay}（${dayOfWeek}）スタッフ不足の時間帯があります`;

  const body = [
    `${dateDisplay}（${dayOfWeek}）のMEDIUMスタッフ配置を確認してください。`,
    '',
    `■ スタッフが ${MIN_STAFF} 名未満の時間帯`,
    slotLines,
    '',
    '■ 翌日のメンバー状況',
    memberLines,
    '',
    '配置を確認・調整してください。',
  ].join('\n');

  MailApp.sendEmail({ to, subject, body });
}

// ── Supabase REST API ────────────────────────────────────────
function fetchSupabase(baseUrl, apiKey, table, query) {
  const url = `${baseUrl}/rest/v1/${table}?${query}`;
  try {
    const res = UrlFetchApp.fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      console.error(`Supabase [${table}] エラー ${res.getResponseCode()}: ${res.getContentText()}`);
      return null;
    }

    return JSON.parse(res.getContentText());
  } catch (e) {
    console.error(`fetchSupabase 例外: ${e}`);
    return null;
  }
}

// ── ユーティリティ ───────────────────────────────────────────
function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function parseGaps(gaps) {
  if (!gaps) return [];
  const arr = typeof gaps === 'string' ? JSON.parse(gaps) : gaps;
  return arr.map(g => ({
    start: timeToMinutes(g.start),
    end:   timeToMinutes(g.end),
  }));
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function getStatusLabel(status) {
  return { MEDIUM_ALL: '終日MEDIUM', AM_MEDIUM_PM_OTHER: '午前MEDIUM', PM_MEDIUM_AM_OTHER: '午後MEDIUM', ABSENT: '不在' }[status] || '未設定';
}

// ── トリガー設定 (一度だけ実行) ──────────────────────────────
function setupDailyTrigger() {
  // 既存トリガーを削除してから再作成
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'checkCoverageAndAlert')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('checkCoverageAndAlert')
    .timeBased()
    .atHour(TRIGGER_HOUR)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  console.log(`毎日 ${TRIGGER_HOUR}:00 JST に checkCoverageAndAlert を実行するトリガーを設定しました`);
}
