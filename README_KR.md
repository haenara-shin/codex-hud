# codex-hud

[![GitHub stars](https://img.shields.io/github/stars/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/watchers)
[![GitHub license](https://img.shields.io/github/license/haenara-shin/codex-hud)](https://github.com/haenara-shin/codex-hud/blob/main/LICENSE)

**[English / 영어](README.md)**

[Claude Code](https://claude.ai/code)에서 OpenAI Codex 사용량과 레이트 리밋을 바로 확인할 수 있는 플러그인입니다.

> [Anthropic community 플러그인 마켓플레이스](https://github.com/anthropics/claude-plugins-community)와 [buildwithclaude](https://github.com/davepoon/buildwithclaude)에 등재되어 있습니다.

## 왜 만들었나?

[codex-plugin-cc](https://github.com/openai/codex-plugin-cc)로 Claude Code에서 Codex에 작업을 위임할 수 있지만, Codex의 레이트 리밋을 확인하려면 터미널을 벗어나야 합니다. **codex-hud**가 그 빈 틈을 채웁니다.

| 기존 도구 | 하는 일 | 못 하는 일 |
|---|---|---|
| [claude-hud](https://github.com/jarrodwatts/claude-hud) | Claude Code 컨텍스트, 도구, 비용 표시 | Codex/OpenAI 데이터 없음 |
| [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) | Claude Code에서 Codex 작업 실행 | 사용량/레이트 리밋 추적 없음 |
| [ccusage](https://github.com/ryoppippi/ccusage) | 로컬 로그 분석 CLI 도구 | Claude Code 플러그인 아님 |
| **codex-hud** | **Claude Code 안에서 Codex 사용량 + 레이트 리밋 확인** | -- |

## 주요 기능

- **실시간 Statusline**: [claude-hud](https://github.com/jarrodwatts/claude-hud)와 통합하여 Claude Code statusline 아래에 Codex Usage/Weekly 레이트 리밋 표시. 세션이 유휴 상태일 때도 리셋 카운트다운이 갱신되도록 60초 주기 새로고침
- **슬래시 명령어**: 사용량, 비용, 요약 전용 명령어
- **이중 데이터 소스**: 로컬 Codex CLI 세션 로그 (API 키 불필요) + OpenAI Usage API (선택, 달러 비용 조회)
- **플랜 무관 동작**: 모든 Codex 플랜(free, Plus, Pro, Team, Enterprise)에서 정상 렌더 — 보고되지 않은 레이트 리밋 윈도우는 건너뛰며 statusline을 깨뜨리지 않음
- **npm 런타임 의존성 제로**: Node.js 내장 모듈만 사용 (statusline wrapper는 Bash와 Perl 필요)
- **우아한 대체 동작**: API 키 없이도 로컬 로그만으로 동작

## Statusline 통합

[claude-hud](https://github.com/jarrodwatts/claude-hud)와 함께 사용하면 Claude Code statusline 아래에 Codex 레이트 리밋이 추가됩니다:

```
[Opus 4.6 (1M context)]              <- claude-hud
my-project
Context ██░░░░░░░░ 19%
Usage   █░░░░░░░░░ 14% (resets in 4h 37m)
Weekly  ██░░░░░░░░ 22% (resets in 5d 18h)
── Codex gpt-5.5·medium ──            <- codex-hud
Usage   █░░░░░░░░░ 1% (resets in 5h)
Weekly  ░░░░░░░░░░ 0% (resets in 7d)
Context ██░░░░░░░░ 18% (47k/258k)
1 session | team
```

헤더에는 가장 최근 Codex 턴이 사용한 모델·reasoning effort가, Context 바에는 해당 세션의 컨텍스트 윈도우 점유율이 표시됩니다. Codex가 rate limit 도달을 보고하면 빨간 `⚠ 한도 초과` 경고가 헤더에 나타납니다 (퍼센트 바가 100% 미만이어도 차단되는 경우를 잡아줍니다).

## 설치

### 방법 A: Anthropic community 마켓플레이스 *(권장)*

Anthropic이 직접 관리하는 디렉터리로, internal review pipeline에서 nightly로 동기화됩니다.

```
/plugin marketplace add anthropics/claude-plugins-community
/plugin install codex-hud@claude-community
```

### 방법 B: buildwithclaude 마켓플레이스

```
/plugin marketplace add davepoon/buildwithclaude
/plugin install codex-hud@buildwithclaude
```

### 방법 C: 이 repo에서 직접

```
/plugin marketplace add haenara-shin/codex-hud
/plugin install codex-hud@codex-hud
```

### 방법 D: 소스에서 빌드

```bash
git clone https://github.com/haenara-shin/codex-hud.git
cd codex-hud
npm install && npm run build
```

Claude Code에서:

```
/plugin marketplace add /path/to/codex-hud
/plugin install codex-hud@codex-hud
```

### Statusline 설정

플러그인 설치 후 아래 명령어를 실행합니다 (멱등적 -- 여러 번 실행해도 안전):

```
/codex-hud:setup
```

- `~/.claude/codex-hud-statusline.sh` symlink 생성
- `~/.claude/settings.json`의 `statusLine.command` 설정 (유휴 중에도 리셋 카운트다운이 갱신되도록 `statusLine.refreshInterval`을 60초로 설정)

Claude Code를 재시작하거나 `/reload-plugins`를 실행하면 반영됩니다.

달러 비용 추적 (선택, OpenAI Admin API 키 필요):

```
/codex-hud:setup-key
```

statusline 제거: `/codex-hud:uninstall` 실행 (저장된 이전 statusline이 있으면 복원됩니다)

## 설정

### 1. 로컬 로그 (자동)

[Codex CLI](https://github.com/openai/codex) 또는 [codex-plugin-cc](https://github.com/openai/codex-plugin-cc)를 사용하면 `~/.codex/sessions/`에 세션 로그가 자동으로 저장됩니다. 별도 설정이 필요 없습니다.

### 2. OpenAI Usage API (선택, 달러 비용용)

달러 비용을 확인하려면 **OpenAI Admin API key**가 필요합니다:

1. [platform.openai.com/settings/organization/admin-keys](https://platform.openai.com/settings/organization/admin-keys) 접속
2. Admin key 생성 (`sk-admin-...`으로 시작) 후 클립보드에 복사
3. Claude Code에서 `/codex-hud:setup-key` 실행 — 키는 클립보드에서 직접 읽으며, 채팅에 입력하지 않습니다

또는 `OPENAI_ADMIN_KEY` 환경변수를 설정하세요.

> **참고**: Teams/Enterprise 구독을 사용 중이면 달러 비용은 의미가 없을 수 있습니다 (구독에 포함). 로컬 로그 기반 레이트 리밋 추적은 API 키 없이도 동작합니다.

## 명령어

### `/codex-hud:setup`

statusline 통합을 설치합니다 (멱등적 — 여러 번 실행해도 안전).

### `/codex-hud:setup-key`

OpenAI Admin API 키를 설정하고 검증합니다 (클립보드 기반, 달러 비용 조회에만 필요).

### `/codex-hud:configure`

표시 옵션 가이드 플로우: 레이아웃, 프리셋, 언어, 바 너비.

### `/codex-hud:uninstall`

statusline 통합을 제거하고 이전 statusline을 복원합니다.

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

### `/codex-hud:costs-today` / `costs-week` / `costs-month` *(beta)*

청구 항목별 비용을 표시합니다 (Admin API 키 필요).

> **Beta**: 이 기능은 실제 Admin API 키로 테스트되지 않았습니다. 종량제(pay-per-token) 플랜에서 데이터가 올바르지 않으면 [이슈를 열어주세요](https://github.com/haenara-shin/codex-hud/issues).

### `/codex-hud:summary`

오늘의 Codex 사용 현황을 한 줄로 요약합니다.

```
Codex today: $1.23 | 1.8M tokens (1.4M cached) | 3 sessions | Rate: 1%/0%
```

## 데이터 소스

| 소스 | 데이터 | 인증 필요 |
|------|--------|-----------|
| 로컬 Codex CLI 로그 (`~/.codex/sessions/`) | 토큰 사용량, 레이트 리밋, 세션 수 | 없음 |
| OpenAI Usage API (`/v1/organization/costs`) | 청구 항목별 달러 비용 | Admin API key |
| OpenAI Usage API (`/v1/organization/usage/completions`) | 조직 전체 토큰 사용량 | Admin API key |

## 업데이트

새 버전으로 업데이트하려면 **반드시 두 명령을 모두** 실행하세요 (플러그인 관리 UI의 "Update now" 버튼만으로는 마켓플레이스 캐시가 갱신되지 않습니다):

```
/plugin marketplace update codex-hud
/plugin update codex-hud@codex-hud
/reload-plugins
```

설치 경로에 따라 alias를 바꿔서 사용하세요 — Anthropic community 마켓플레이스는 `claude-community`, buildwithclaude는 `buildwithclaude`, 이 repo 직접 설치는 `codex-hud`.

## 요구사항

- Node.js >= 18.0.0
- [Claude Code](https://claude.ai/code)
- [Codex CLI](https://github.com/openai/codex) 또는 [codex-plugin-cc](https://github.com/openai/codex-plugin-cc)
- [claude-hud](https://github.com/jarrodwatts/claude-hud) (선택, statusline 통합용)
- OpenAI Admin API key (선택, 비용 데이터용)

## 감사의 말

codex-hud는 Claude Code 자체의 사용량 가시성 문제를 statusline으로 해결한 [claude-hud](https://github.com/jarrodwatts/claude-hud)에서 영감을 받아 만들어졌습니다. 같은 아이디어를 OpenAI Codex로 확장한 것이며, 두 플러그인이 함께 설치된 경우 wrapper 스크립트로 자연스럽게 통합됩니다.

## 변경 이력

### v0.8.0

- **절대 리셋 시각** (Codex의 `/status`처럼). 리셋 힌트가 윈도우가 리셋되는 시각을 함께 표시합니다 — `resets 19:38`, 오늘이 지났으면 `resets 15:04 on 22 Jun` — 남은 시간과 같이: `(resets 19:38 · 4h 37m)`. 신규 `resetStyle` 옵션(`both`(기본) / `absolute` / `relative`), 한국어 현지화(`리셋 19:38 · 4h 37m`). `/codex-hud:configure`에서 실시간 미리보기로 설정 가능.

### v0.7.0

- **`/codex-hud:configure`에 실시간 미리보기.** 레이아웃을 고를 때, 각 옵션이 실제로 어떻게 보일지 사이드바이사이드 미리보기로 표시됩니다 — 실제 statusline 코드로 렌더(샘플 데이터 + 현재 토글 반영)하므로 결과와 절대 어긋나지 않습니다. 질문 UI용으로 색 코드 없는 플레인 출력을 내는 `preview` 서브커맨드(`node dist/index.js preview --set layout=compact`)를 추가했습니다.

### v0.6.2

- **Horizontal 레이아웃을 기존 모양으로 복원** (헤더 + 나란히 bar + 푸터). v0.6.1의 한 줄 버전은 별도 **`inline`** 레이아웃으로 유지 — `/codex-hud:configure`에서 선택 가능 (이제 4개 레이아웃: expanded / horizontal / inline / compact).

### v0.6.1

- **Horizontal 레이아웃을 진짜 한 줄로 재설계** (claude-hud 스타일): `Codex team gpt-5.5·medium │ Usage ████░░░░░░ 42% (2h) │ Weekly ████████░░ 81% (2d 7h) │ Context ██░░░░░░░░ 18% │ 2s`. 이전에는 헤더/푸터가 별도 줄이었으나, 이제 bar를 포함한 모든 요소가 한 줄에 표시되어 위의 claude-hud 메트릭 줄과 같은 모양이 됩니다.

### v0.6.0

- **모델 + effort 배지**: 가장 최근 Codex 턴이 사용한 모델과 reasoning effort를 헤더에 표시 (예: `── Codex gpt-5.5·medium ──`). `showModel`로 토글.
- **Context 바**: 최근 세션의 컨텍스트 윈도우 점유율 (`Context ██░░░░░░░░ 18% (47k/258k)`) — claude-hud의 간판 기능을 Codex 쪽에도. `showContext`로 토글.
- **`⚠ 한도 초과` 경고**: Codex가 `rate_limit_reached_type`을 보고하면 헤더에 빨간 배지 표시 — 퍼센트 바가 100% 미만인데 요청이 차단되는 경우를 잡아줌.
- 세 요소 모두 3개 레이아웃(expanded/horizontal/compact)에서 렌더되며, 기존 tail-read 윈도우에서 나오는 데이터라 추가 I/O 없음.

### v0.5.2

- Compact 레이아웃 세션 수 접미사 현지화 (`15s` / `15 세션`).
- `costs --daily` 날짜 컬럼에 `(UTC)` 라벨 추가 (API 버킷 경계와 일치).
- 설치 출력이 이전 statusline을 실제로 저장했을 때만 "saved"라고 표시.
- 명령 `allowed-tools`를 `Bash(node:*)`보다 좁히는 방안 조사: `${CLAUDE_PLUGIN_ROOT}` 치환이 skill 본문/훅/MCP 설정에는 문서화되어 있으나 frontmatter에는 없음 → 자동 승인이 조용히 깨질 위험이 있어 보류 확정.

### v0.5.1

전체 다차원 코드 리뷰(33개 발견, 적대적 검증)로 만들어진 품질 릴리스.

- **수정 (설치):** statusline 진입점이 이제 현재 플러그인 설치 위치를 런타임에 해석하는 launcher 스크립트입니다. 이전에는 symlink가 버전 번호가 붙은 플러그인 캐시를 가리켜서, 첫 `/plugin update` 시 statusline 전체가 조용히 사라졌습니다.
- **보안 (키 처리):** `/codex-hud:setup-key`가 이제 Admin 키를 클립보드에서 읽어 stdin으로 전달합니다(`setup --key-stdin`). 키가 더 이상 채팅 기록이나 프로세스 인자에 남지 않습니다.
- **수정 (정확도):** 최신 rate limit 스냅샷을 이벤트 timestamp 기준으로 선택합니다 (이전: 파일 경로 정렬 — 낡은 스냅샷에 바가 몇 시간 동결될 수 있었음). 자정을 넘긴 세션도 "오늘" 범위에서 반영됩니다.
- **성능:** 큰 rollout 파일(>256KB)은 매 렌더마다 전체 파싱하지 않고 tail-read합니다 — 20MB 활성 세션 기준 렌더당 ~200ms → ~1ms.
- **견고성:** 설치 시 기존 `statusLine`의 다른 필드를 보존하고 이전 statusline을 저장합니다. 새 명령 `/codex-hud:uninstall`이 이를 복원합니다. settings.json 쓰기는 atomic. wrapper는 PATH에 node가 없어도 메시지를 표시하며, claude-hud를 마켓플레이스 alias와 무관하게 플러그인 메타데이터로 찾습니다.
- **수정 (비용):** 전진하지 않는 API 커서 가드, API가 결과를 잘랐을 때 보이는 경고 추가.
- 문서: 잘못된 `/codex-hud:setup` → `/codex-hud:setup-key` 안내 전부 수정, CLI help 완성, configure 플로우 모순 해소.

### v0.5.0

- **수정:** 레이트 리밋 윈도우가 없는 플랜(예: free / 무제한 플랜은 `primary` 또는 `secondary`가 `null`)에서 statusline이 더 이상 크래시하지 않습니다. 없는 윈도우는 건너뛰고 나머지는 정상 렌더됩니다.
- **수정:** `costs-month` / `usage-month`가 전체 기간을 보고합니다. OpenAI Costs/Usage API는 페이지당 일별 버킷 수가 제한(기본 7개)되어 있어, 30일 조회 시 이전에는 에러 없이 약 7일치만 반환됐습니다. 이제 요청 크기를 맞추고 `has_more`/`next_page` 페이지네이션을 따라갑니다.
- **추가:** statusline 등록 시 `refreshInterval: 60`을 설정하여 유휴 중에도 리셋 카운트다운이 갱신됩니다.
- **정리:** `plugin.json`의 명시적 `commands[]` 배열 제거(명령어 자동 탐색), 두 매니페스트에 `$schema` 추가, 현행 Claude Code 2.1.x / Codex CLI 0.125+ 계약 대조 검증.

### v0.4.0

- 가로 레이아웃(Usage + Weekly 나란히) 추가; 총 3가지 레이아웃(expanded / horizontal / compact).

## 라이선스

MIT
