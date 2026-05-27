開発サーバーとCloudflareトンネルを起動して、外部アクセス可能なURLを生成してください。
ポートは **3000 固定**。

手順:
1. まず既存プロセスを確実にクリーンアップする:
   - `pkill -f "cloudflared tunnel" 2>/dev/null` で既存トンネルを停止
   - `fuser -k 3000/tcp 2>/dev/null` でポート3000を解放
   - `rm -f .next/dev/lock` でロックファイルを削除
   - `sleep 2` で確実に解放を待つ
2. `source ~/.nvm/nvm.sh && nvm use 20 && npx next dev --turbopack --port 3000` を `run_in_background` で起動する
3. curlで200が返るまでループで待つ（最大30秒、2秒間隔）:
   ```
   for i in $(seq 1 15); do
     code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
     if [ "$code" = "200" ]; then echo "ready"; break; fi
     sleep 2
   done
   ```
4. サーバー起動を確認したら `cloudflared tunnel --url http://localhost:3000` を `run_in_background` で起動する
5. `sleep 6` 後に出力ファイルから `https://....trycloudflare.com` のURLをgrepで取得してユーザーに提示する

注意:
- サーバー起動・トンネル起動は `run_in_background` を使う
- trycloudflare.com のURLは毎回変わる一時的なもの
- ポートは **必ず3000** を使う。別ポートにフォールバックしない
- 起動前に必ず既存プロセスをクリーンアップする（ゾンビプロセス対策）
- Turbopackキャッシュ破損時は `.next` ディレクトリを削除してリトライする
