// 朝昼の告知(プロモ)を自動投稿するボット【半自動・最終スイッチ付き】
// Googleスプレッドシート(CSV公開)から行を読み、
//   ・投稿OK 列にチェック(TRUE)が入っている
//   ・date が今日以前
//   ・slot が今の時間帯(朝/昼)と一致(空欄は両方可)
//   ・まだ投稿していない
// の全てを満たす行だけを X へ投稿する。投稿済みは state/promo_posted.json で管理。
// ※ 下書きの生成(キーワード→文章)は Googleシート側のGAS(コード.gs)が担当。ここは投稿専任。
//
// 環境変数:
//   PROMO_SHEET_CSV_URL : Googleシートを「ウェブに公開 → CSV」にした公開URL
//   X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET : 既存のXシークレット
//   MAX_PER_RUN : 1回の実行で投稿する最大件数(既定2)
//   DRY_RUN : '1' で投稿せず内容だけ表示
import fs from 'fs/promises';
import path from 'path';
import { postToX } from './x.js';

const STATE_PATH = path.resolve('state/promo_posted.json');
const CSV_URL = process.env.PROMO_SHEET_CSV_URL;
const MAX_PER_RUN = parseInt(process.env.MAX_PER_RUN || '2', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

// --- 最小CSVパーサ(引用符・カンマ・改行に対応) ---
function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
            else if (c === '\r') { /* skip */ }
            else field += c;
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

function nowJst() { return new Date(Date.now() + 9 * 3600 * 1000); }
function jstDateStr(d) { return d.toISOString().slice(0, 10); }

// 「投稿OK」の判定(Googleチェックボックスは公開CSVで TRUE/FALSE になる)
function isApproved(v) {
    const s = String(v || '').trim().toLowerCase();
    return ['true', '1', 'ok', 'はい', 'yes', '✓', '済', '投稿'].includes(s);
}

async function loadState() {
    try { return new Set(JSON.parse(await fs.readFile(STATE_PATH, 'utf8'))); }
    catch { return new Set(); }
}
async function saveState(set) {
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    await fs.writeFile(STATE_PATH, JSON.stringify([...set], null, 2) + '\n');
}

async function main() {
    if (!CSV_URL) { console.log('PROMO_SHEET_CSV_URL 未設定のためスキップ'); return; }

  const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error('シートCSV取得失敗: ' + res.status);
    const rows = parseCsv(await res.text());
    if (rows.length < 2) { console.log('シートに行がありません'); return; }

  const header = rows[0].map(function (h) { return h.trim(); });
    const idx = {
        id: header.indexOf('id'),
        date: header.indexOf('date'),
        slot: header.indexOf('slot'),
        text: header.indexOf('text'),
        ok: header.indexOf('投稿OK') >= 0 ? header.indexOf('投稿OK') : header.indexOf('approved'),
    };
    if (idx.date < 0 || idx.text < 0) {
        throw new Error("ヘッダに 'date' と 'text' の列が必要です");
    }
    // 最終スイッチ列が無ければ安全側に倒して何も投稿しない
  if (idx.ok < 0) {
        console.log("『投稿OK』(または approved)列が見つかりません。安全のため投稿を行いません。列を追加してください。");
        return;
    }

  const now = nowJst();
    const today = jstDateStr(now);
    const curSlot = now.getUTCHours() < 11 ? '朝' : '昼';

  const posted = await loadState();
    const items = rows.slice(1)
        .map(function (r, n) {
                const id = idx.id >= 0 && r[idx.id] ? String(r[idx.id]).trim() : 'row' + (n + 2);
                return {
                        key: id,
                        date: (r[idx.date] || '').trim(),
                        slot: idx.slot >= 0 ? (r[idx.slot] || '').trim() : '',
                        text: (r[idx.text] || '').trim(),
                        ok: isApproved(r[idx.ok]),
                };
        })
        .filter(function (it) { return it.ok; })                      // ★最終スイッチ:投稿OKだけ
        .filter(function (it) { return it.text && it.date; })
        .filter(function (it) { return !posted.has(it.key); })
        .filter(function (it) { return it.date <= today; })
        .filter(function (it) { return !it.slot || it.slot === curSlot; })
        .slice(0, MAX_PER_RUN);

  if (items.length === 0) { console.log('投稿対象なし (' + today + ' ' + curSlot + ')'); return; }

  for (const it of items) {
        if (DRY_RUN) {
                console.log('[DRY] key=' + it.key + ' (' + it.date + '/' + (it.slot || 'any') + ') 投稿OK\n' + it.text + '\n');
                posted.add(it.key);
                continue;
        }
        try {
                const xId = await postToX(it.text);
                console.log('プロモ投稿OK: key=' + it.key + ' (' + xId + ')');
                posted.add(it.key);
                await saveState(posted);
        } catch (e) {
                console.error('プロモ投稿失敗: key=' + it.key + ' — ' + e.message);
                break;
        }
  }
    if (DRY_RUN) { console.log('(dry-run: 状態は保存しません)'); return; }
    console.log('プロモ進捗: ' + posted.size + ' 件 投稿済み');
}

main().catch(function (e) { console.error(e); process.exit(1); });
