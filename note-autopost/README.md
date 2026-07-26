# note-autopost — noteの新着をXへ自動告知＋朝昼はAIが下書きする半自動投稿

非エンジニアでも作れる、自分専用の投稿ボット一式。**コピペで再現できます。**

このリポジトリは2つの仕組みを含みます。

1. **note→X 自動告知**（全自動）: noteに新記事を公開すると、15分以内にXへ告知が飛ぶ。（Threadsも任意で同時に飛ばせる）
2. **朝昼プロモ 半自動投稿**（承認制）: キーワードからAIが下書きを作り、あなたが確認して「投稿OK」にチェックした行だけを、朝8:00・昼12:45にXへ投稿する。

すべて GitHub Actions（無料枠）＋ Googleスプレッドシート/GAS（無料枠）で動きます。かかる費用は X API の従量課金のみ（月およそ1,000円）。

---

## 必要なもの

- GitHub アカウント（無料）
- X の開発者アカウントと API キー4つ（**アプリ権限は「Read and Write」必須**）／X API は従量課金
- Google アカウント（スプレッドシート・GAS・Gemini APIキーに使用。いずれも無料枠）
- （任意）Meta 開発者登録と Threads の User ID・トークン

---

## リポジトリ構成

```
note-autopost/
├─ .github/workflows/
│   ├─ notify.yml        # note→X告知（15分ごと）
│   └─ promo.yml         # 朝昼プロモ（8:00 / 12:45 JST）
├─ src/
│   ├─ index.js          # 告知の本体
│   ├─ rss.js  state.js  text.js  x.js  threads.js
│   └─ promo.js          # 朝昼プロモの投稿処理
├─ state/
│   ├─ posted.json       # 告知の投稿済み（[]で開始）
│   └─ promo_posted.json # プロモの投稿済み（[]で開始）
├─ gas/
│   └─ コード.gs         # Googleシートに貼るスクリプト（下書き生成＋リマインドメール）
├─ data/
│   └─ 朝昼プロモ_サンプルシート.csv
├─ package.json  .gitignore  .env.example
├─ README.md
└─ 運用マニュアル.md
```

---

## セットアップ手順（全部ブラウザだけ）

### A. note→X 自動告知

1. このリポジトリを自分のGitHubに用意する（フォーク or 中身をコピー）
2. `.github/workflows/notify.yml` と `src/index.js` の `YOUR_NOTE_ID` を、自分のnoteのIDに変更
3. Xの開発者ポータルでアプリを作成 → **権限を「Read and Write」に設定してから** APIキー4つ（API Key/Secret・Access Token/Secret）を発行
4. GitHub → Settings → Secrets and variables → **Actions → Secrets** に登録:
   `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_SECRET`
   （Threadsを使うなら `THREADS_USER_ID` / `THREADS_TOKEN` も）
5. X APIはPPU（従量課金）。**支出上限**を設定し、少額チャージしておく
6. Actions → note-autopost → Run workflow → **「init」にチェック**して1回実行（既存記事を投稿済み化＝過去記事の一斉投稿を防ぐ）
7. 以降は自動。noteに公開すると15分以内にXへ告知が飛ぶ

### B. 朝昼プロモ 半自動投稿

1. Googleスプレッドシートを新規作成し、`data/朝昼プロモ_サンプルシート.csv` を ファイル→インポートで取り込む
   （列: `id / date / slot / keywords / text / 投稿OK`。date列はプレーンテキスト書式に。投稿OK列はチェックボックスにすると便利）
2. スプレッドシート → 拡張機能 → Apps Script に `gas/コード.gs` を貼り付け
3. Google AI Studio (https://aistudio.google.com/apikey) で**無料のGemini APIキー**を取得
4. Apps Script のプロジェクト設定:
   - タイムゾーンを **(GMT+09:00) 東京** に
   - スクリプト プロパティに `GEMINI_API_KEY` = 取得したキー を追加
   - コード内の `TO_EMAIL` を自分のメールに、`STYLE` を自分のプロフィール/文体に書き換え
5. Apps Scriptで `setupReminders` を実行（初回だけ権限承認）→ 朝7:15/昼12:00のリマインドメールが有効に
6. スプレッドシートを ファイル→共有→**ウェブに公開→CSV** で公開し、URLをコピー
7. GitHub → Settings → Secrets and variables → **Actions → Variables** に
   `PROMO_SHEET_CSV_URL` = そのCSV URL を登録
8. テスト: Actions → note-promo → Run workflow → **「Dry run」にチェック**して実行し、ログに下書きが出ればOK

---

## 毎日の使い方（あなたの作業は3つだけ）

1. スプレッドシートに **キーワード**を入れる（date/slotも）
2. 朝7:15・昼12:00の**リマインドメール**が届く（下書きはAIが自動生成済み）→ リンクでシートを開いて確認
3. 出す行の **「投稿OK」にチェック** → 朝8:00・昼12:45に自動投稿

> ⚠️ AIが書いた数字（件数・%・時間など）は事実とは限りません。投稿前に必ず確認を。

---

## つまずきやすい点（ハマったら見る）

- **Actionsが赤（lock file not found）** → `npm ci` ではなく `npm install`。`setup-node` の `cache: 'npm'` は入れない
- **exit code 128** → `state/posted.json` `state/promo_posted.json`（中身 `[]`）が無いと失敗。存在を確認
- **note-promo が Actions に出ない** → `promo.yml` は `.github/workflows/` の中に置く（ルートやsrc配下はNG）
- **Geminiが 429/404** → モデル世代交代。使えるモデル名（例 `gemini-3.6-flash`）に差し替え。エラーログに手がかりあり
- **下書きが途中で切れる/空** → `maxOutputTokens` を大きく。`thinkingConfig` は使わない（モデルによっては400になる）
- **下書きが0件** → 対象は「keywordsあり・textが空」の行だけ。textを空にして再実行
- **X投稿できない鍵ができた** → アプリ権限を「Read and Write」にしてから Access Token を発行し直す

詳しい運用は `運用マニュアル.md` を参照。

---

## 費用の目安

- X API（PPU/従量課金）: 通常投稿 約$0.015、URL付き 約$0.20。1日2〜3投稿で **月およそ1,000円**。支出上限の設定を推奨
- Gemini / GAS / GitHub Actions: 個人利用は無料枠内

---

## ライセンス / 注意

- 各API（X, Threads, Gemini）の利用規約・自動投稿ポリシー・レート制限を必ず守ること
- APIキーはコードに直書きせず、必ずGitHubのSecrets/Variablesへ
- Threads・Xのトークンは有効期限があるため、切れたら更新すること
