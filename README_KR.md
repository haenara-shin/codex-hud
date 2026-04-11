# codex-hud

[![GitHub stars](https://img.shields.io/github/stars/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/watchers)
[![GitHub license](https://img.shields.io/github/license/haenara-shin/codex-hud)](https://github.com/haenara-shin/codex-hud/blob/main/LICENSE)
[![Star History Chart](https://api.star-history.com/svg?repos=haenara-shin/codex-hud&type=Date)](https://star-history.com/#haenara-shin/codex-hud&Date)

**[English / 영어](README.md)**

[Claude Code](https://claude.ai/code)에서 OpenAI Codex 사용량과 레이트 리밋을 바로 확인할 수 있는 플러그인입니다.

## 왜 만들었나?

[codex-plugin-cc](https://github.com/openai/codex-plugin-cc)로 Claude Code에서 Codex에 작업을 위임할 수 있지만, Codex의 레이트 리밋을 확인하려면 터미널을 벗어나야 합니다. **codex-hud**가 그 빈 틈을 채웁니다.

| 기존 도구 | 하는 일 | 못 하는 일 |
|---|---|---|
| [claude-hud](https://github.com/jarrodwatts/claude-hud) | Claude Code 컨텍스트, 도구, 비용 표시 | Codex/OpenAI 데이터 없음 |
| [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) | Claude Code에서 Codex 작업 실행 | 사용량/레이트 리밋 추적 없음 |
| [ccusage](https://github.com/ryoppippi/ccusage) | 로컬 로그 분석 CLI 도구 | Claude Code 플러그인 아님 |
| **codex-hud** | **Claude Code 안에서 Codex 사용량 + 레이트 리밋 확인** | -- |

## 주요 기능

- **실시간 Statusline**: [claude-hud](https://github.com/jarrodwatts/claude-hud)와 통합하여 Claude Code statusline 아래에 Codex Usage/Weekly 레이트 리밋 표시
- **슬래시 명령어**: 사용량, 비용, 요약 전용 명령어
- **이중 데이터 소스**: 로컬 Codex CLI 세션 로그 (API 키 불필요) + OpenAI Usage API (선택, 달러 비용 조회)
- **런타임 의존성 제로**: Node.js 내장 모듈만 사용
- **우아한 대체 동작**: API 키 없이도 로컬 로그만으로 동작

## Statusline 통합

[claude-hud](https://github.com/jarrodwatts/claude-hud)와 함께 사용하면 Claude Code statusline 아래에 Codex 레이트 리밋이 추가됩니다:

```
[Opus 4.6 (1M context)]              <- claude-hud
my-project
Context ██░░░░░░░░ 19%
Usage   █░░░░░░░░░ 14% (resets in 4h 37m)
Weekly  ██░░░░░░░░ 22% (resets in 5d 18h)
── Codex team ──                      <- codex-hud
Usage   █░░░░░░░░░ 1% (resets in 5h)
Weekly  ░░░░░░░░░░ 0% (resets in 7d)
1 session | team
```

## 설치

```bash
git clone https://github.com/haenara-shin/codex-hud.git
cd codex-hud
npm install && npm run build
```

Claude Code에서 로컬 디렉토리를 마켓플레이스로 추가하고 설치:

```
/plugin marketplace add /path/to/codex-hud
/plugin install codex-hud@codex-hud
```

### Statusline 설정 (선택)

claude-hud와 함께 Codex 레이트 리밋을 statusline에 표시하려면:

```bash
ln -sf /path/to/codex-hud/scripts/statusline-wrapper.sh ~/.claude/codex-hud-statusline.sh
```

`~/.claude/settings.json`에서:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/Users/YOU/.claude/codex-hud-statusline.sh"
  }
}
```

wrapper는 claude-hud를 먼저 실행한 후 codex-hud 출력을 아래에 추가합니다.

## 설정

### 1. 로컬 로그 (자동)

[Codex CLI](https://github.com/openai/codex) 또는 [codex-plugin-cc](https://github.com/openai/codex-plugin-cc)를 사용하면 `~/.codex/sessions/`에 세션 로그가 자동으로 저장됩니다. 별도 설정이 필요 없습니다.

### 2. OpenAI Usage API (선택, 달러 비용용)

달러 비용을 확인하려면 **OpenAI Admin API key**가 필요합니다:

1. [platform.openai.com/settings/organization/admin-keys](https://platform.openai.com/settings/organization/admin-keys) 접속
2. Admin key 생성 (`sk-admin-...`으로 시작)
3. Claude Code에서 `/codex-hud:setup` 실행 후 키 입력

또는 `OPENAI_ADMIN_KEY` 환경변수를 설정하세요.

> **참고**: Teams/Enterprise 구독을 사용 중이면 달러 비용은 의미가 없을 수 있습니다 (구독에 포함). 로컬 로그 기반 레이트 리밋 추적은 API 키 없이도 동작합니다.

## 명령어

### `/codex-hud:setup`

OpenAI Admin API 키를 설정하고 연결을 확인합니다.

### `/codex-hud:usage-today` / `usage-week` / `usage-month`

토큰 사용량을 표시합니다.

```
## Codex Usage - Last 7 Days

### Local Sessions (10 sessions)

| Metric       | Tokens   |
|--------------|----------|
| Input        | 3.4M     |
| Cached Input | 2.7M     |
| Output       | 114.9k   |
| Reasoning    | 82.4k    |
| **Total**    | **3.5M** |

Rate limit: 6.0% (5h) / 14.0% (7d) | Plan: team
```

### `/codex-hud:costs-today` / `costs-week` / `costs-month`

모델별 비용을 표시합니다 (Admin API 키 필요).

### `/codex-hud:summary`

오늘의 Codex 사용 현황을 한 줄로 요약합니다.

```
Codex today: $1.23 | 1.8M tokens (1.4M cached) | 3 sessions | Rate: 1%/0%
```

## 데이터 소스

| 소스 | 데이터 | 인증 필요 |
|------|--------|-----------|
| 로컬 Codex CLI 로그 (`~/.codex/sessions/`) | 토큰 사용량, 레이트 리밋, 세션 수 | 없음 |
| OpenAI Usage API (`/v1/organization/costs`) | 모델별 달러 비용 | Admin API key |
| OpenAI Usage API (`/v1/organization/usage/completions`) | 조직 전체 토큰 사용량 | Admin API key |

## 요구사항

- Node.js >= 18.0.0
- [Claude Code](https://claude.ai/code)
- [Codex CLI](https://github.com/openai/codex) 또는 [codex-plugin-cc](https://github.com/openai/codex-plugin-cc)
- [claude-hud](https://github.com/jarrodwatts/claude-hud) (선택, statusline 통합용)
- OpenAI Admin API key (선택, 비용 데이터용)

## 라이선스

MIT
