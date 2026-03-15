開発サーバーとCloudflareトンネルを起動して、外部アクセス可能なURLを生成してください。

手順:
1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` でサーバーが既に動いているか確認する
   - 200が返ればサーバーは稼働中 → そのまま使う
   - それ以外なら `source ~/.nvm/nvm.sh && nvm use 20 && npx next dev --port 3000` を `run_in_background` で起動し、curlで200が返るまで待つ
2. `cloudflared tunnel --url http://localhost:3000` を `run_in_background` で起動する
3. `sleep 5` 後に出力から `https://....trycloudflare.com` のURLをgrepで取得してユーザーに提示する

注意:
- サーバー起動・トンネル起動は `run_in_background` を使う
- trycloudflare.com のURLは毎回変わる一時的なもの
- サーバーが既に起動済みの場合は再起動しない
- ポート確認には `lsof` や `netstat` ではなく `curl` を使う（最も確実）
