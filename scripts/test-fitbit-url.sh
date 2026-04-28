#!/usr/bin/env bash
# 사용법: bash scripts/test-fitbit-url.sh         # EDA 포함
#        bash scripts/test-fitbit-url.sh --no-eda # EDA 제외
set -e

EDA_PARAM=""
if [[ "$1" == "--no-eda" ]]; then EDA_PARAM="?eda=false"; fi

# 1) 로그인
LOGIN_BODY='{"user_id":"user_001","password":"demo1234"}'
TOKEN=$(curl -s -X POST http://43.202.54.55:8080/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d "$LOGIN_BODY" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo "TOKEN: ${TOKEN:0:24}... (len ${#TOKEN})"
echo

# 2) authorize URL 생성
URL=$(curl -s -H "authorization: Bearer $TOKEN" \
  "http://43.202.54.55:8080/api/v1/fitbit/authorize${EDA_PARAM}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')

echo "==== AUTHORIZE URL ===="
echo "$URL"
echo
echo "==== SCOPE ===="
echo "$URL" | python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.stdin.read()).query);print(q.get("scope",[""])[0])'
