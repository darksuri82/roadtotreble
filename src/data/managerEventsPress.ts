import type { ManagerEventTemplate } from '../types/condition';

/**
 * 36 Press Conference Events:
 * - 18 Team-wide
 * - 8 Position-group targeted (FW / MF / DF_GK)
 * - 10 Individual player targeted
 */
export const PRESS_CONFERENCE_EVENTS: ManagerEventTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════
  // A. TEAM-WIDE PRESS CONFERENCES (18)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'pc_team_01_opp_provoke',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'big_match',
    title: '상대 감독의 선제 도발',
    speakerLabel: '사전 기자회견 · 현지 기자단',
    prompt:
      '감독님, {opponentName} 감독이 방금 사전 인터뷰에서 "{teamName}은 운이 좀 따랐을 뿐, 우리 전술 앞에서는 90분 내내 공 구경도 못 할 것"이라며 대놓고 도발했습니다. 한 말씀 하시죠?',
    choices: [
      {
        id: 'a',
        label: '무리뉴식 능청 카운터',
        toneTag: '능청 도발',
        quote:
          '"그 친구가 공을 그렇게 좋아하면 경기 끝나고 매치볼 하나 사서 택배로 보내주죠. 점유율 트로피라는 게 있으면 먼저 가져가라고 하세요. 우린 승점 3점만 챙기겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'FW',
          secondaryGroupDelta: 1,
          reactionText:
            '📰 "점유율 트로피는 택배로" — 현지 언론 헤드라인 폭발! 라커룸에서 선수들이 인터뷰 영상을 돌려 보며 크게 웃고 투지를 불태웁니다.',
        },
      },
      {
        id: 'b',
        label: '안첼로티식 여유 & 눈썹',
        toneTag: '노련한 여유',
        quote:
          '(왼쪽 눈썹만 살짝 올리며) "글쎄요, 내가 그분 전술 노트를 훔쳐보진 않았지만… 90분 뒤에 누가 더 웃고 있는지 보면 되겠죠. 질문 하나 더 없나요? 저녁에 파스타 예약해 둬서."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 노련한 여유에 상대 감독의 도발이 김빠져 버렸습니다. 선수단이 차분하게 빅매치를 준비합니다.',
        },
      },
      {
        id: 'c',
        label: '도서관 정숙 모드 선언',
        toneTag: '정면 맞불',
        riskLabel: '하이리스크 (65%)',
        successChance: 0.65,
        quote:
          '"입으로 축구하는 시대는 끝났습니다. 내일 {opponentName} 홈팬들 앞에서 아예 도서관 정숙 모드로 만들어 버리겠습니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 "도서관 정숙 모드" 발언이 선수들의 승부욕에 기름을 부었습니다! 라커룸이 뜨겁게 달아오릅니다.',
        },
        failEffect: {
          teamMoraleDelta: -1,
          reactionText:
            '❄️ 언론의 스포트라이트가 과도하게 쏟아지며 일부 어린 선수들이 살짝 경직됩니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_02_rotation_overwork',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'fatigue_overload',
    title: '주전 혹사·로테이션 논란',
    speakerLabel: '공식 기자회견 · 스포츠 데일리',
    prompt:
      '최근 일정이 살인적인데 주전 선수들을 거의 빼지 않고 있습니다. SNS에서는 "감독님이 선수들을 AI 봇처럼 갈아 넣는다"는 밈까지 돌고 있는데, 로테이션 계획은 없으신가요?',
    choices: [
      {
        id: 'a',
        label: '퍼거슨식 기자 역공',
        toneTag: '강경 방패',
        quote:
          '"그 SNS 밈 만든 사람한테 주급 대신 내달라고 하세요. 여기 훈련장 의료팀 데이터는 내가 제일 잘 압니다. 다음 질문, 축구 얘기합시다."',
        successEffect: {
          starterMoraleDelta: 1,
          benchMoraleDelta: -1,
          reactionText:
            '📰 날 선 기자회견 직후 주전 선수들은 감독의 옹호에 고마워했지만, 벤치 멤버들은 씁쓸한 표정을 감추지 못합니다.',
        },
      },
      {
        id: 'b',
        label: '펩식 진지한 로테이션 예고',
        toneTag: '스쿼드 신뢰',
        quote:
          '"선수들은 기계가 아닙니다. 사실 어제 밤새 뛴 거리 그래프를 보다가 커피를 세 잔이나 쏟았죠. 다음 경기부터는 벤치에서 칼 갈고 있는 선수들에게 확실히 기회를 줄 겁니다."',
        successEffect: {
          benchMoraleDelta: 2,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 백업 선수들이 훈련장에서 눈빛부터 달라졌습니다. 스쿼드 전체에 건강한 경쟁 분위기가 돕니다.',
        },
      },
      {
        id: 'c',
        label: '쿨한 셀프 디스 유머',
        toneTag: '유쾌한 드립',
        quote:
          '"저도 선수들 뛸 때마다 벤치에서 심박수 140 찍습니다. 저도 갈리고 있어요! 농담이고, 스포츠 과학팀과 협의해 피로 관리는 철저히 조절 중입니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 기자회견장에 웃음이 터지며 혹사 논란이 가볍게 진화됐습니다. 라커룸 분위기도 한결 가벼워집니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_03_win_streak_hype',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'win_streak',
    title: '파죽지세 연승 행진과 우승 질문',
    speakerLabel: '경기 후 기자회견 · 방송사 리포터',
    prompt:
      '{streak}연승입니다! 전문가들 사이에서 벌써 "{teamName}이 트로피에 리본을 묶고 있다"는 극찬이 쏟아지는데, 우승을 확신하시나요?',
    choices: [
      {
        id: 'a',
        label: '안첼로티식 김칫국 경계',
        toneTag: '침착한 겸손',
        quote:
          '"트로피에 리본은 마지막 날에 묶는 겁니다. 지금 샴페인 따면 시즌 끝에 탄산 다 빠져서 못 마셔요. 우린 다음 경기 {opponentName}만 생각합니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 "탄산 빠진 샴페인" 비유가 화제가 됐습니다. 들뜰 수 있던 선수단이 기분 좋게 집중력을 유지합니다.',
        },
      },
      {
        id: 'b',
        label: '클롭식 화끈한 자신감',
        toneTag: '열정 폭발',
        quote:
          '"왜 꿈꾸는 걸 부끄러워해야 하죠? 지금 우리 라커룸 에너지가 미쳤습니다. 팬들이 즐기고 싶다면 마음껏 소리 지르셔도 됩니다. 우리가 끝까지 책임지겠습니다!"',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 홈팬들과 선수단이 하나로 뭉칩니다! 라커룸 분위기가 최고조로 치솟습니다.',
        },
      },
      {
        id: 'c',
        label: '무리뉴식 언더독 코스프레',
        toneTag: '언론 플레이',
        quote:
          '"우승요? 에이, 우리 팀은 아직 우유 마시는 망아지일 뿐입니다. 진짜 우승 후보는 저기 돈 수억 유로씩 쓰는 팀들이죠. 우린 그냥 매 경기 1점이라도 주워 담으려 합니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 뻔뻔한 "망아지" 발언에 기자들이 폭소했습니다. 선수들은 부담 없이 웃으며 훈련에 임합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_04_lose_streak_crisis',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'lose_streak',
    title: '연패 위기 & 경질설 질문',
    speakerLabel: '경기 후 기자회견 · 타블로이드 기자',
    prompt:
      '{streak}연패입니다. 벌써 일부 매체에서 감독님의 전술이 읽혔다며 "경질 배당률이 급락했다"는 기사까지 내고 있습니다. 라커룸 장악력에 문제가 있나요?',
    choices: [
      {
        id: 'a',
        label: '무리뉴식 "말을 아끼겠다"',
        toneTag: '시니컬 카운터',
        quote:
          '"I prefer not to speak. 지금 입 열면 나만 벌금 물거든요. 경질 배당률에 돈 걸고 싶은 사람은 걸어 보시죠. 시즌 끝에 그 영수증 찢게 해드릴 테니까."',
        successEffect: {
          teamMoraleDelta: 1,
          frozenReliefBonus: 1,
          reactionText:
            '📰 강렬한 한마디에 기자회견장이 술렁입니다. 선수들은 흔들리지 않는 감독의 배짱에 안도합니다.',
        },
      },
      {
        id: 'b',
        label: '모든 화살 본인에게 돌리기',
        toneTag: '방패막이',
        quote:
          '"비판할 거면 저한테 하세요. 선수들은 경기장에서 피 땀 흘렸고, 결과가 안 나온 건 전술 짠 내 책임입니다. 라커룸 문제? 들어와 보지도 않고 소설 쓰지 마세요."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 감독이 언론의 총알을 온몸으로 막아주자 선수들이 깊은 신뢰와 미안함을 느끼며 똘똘 뭉칩니다.',
        },
      },
      {
        id: 'c',
        label: '강경한 선수단 분발 촉구',
        toneTag: '공개 압박',
        riskLabel: '하이리스크 (55%)',
        successChance: 0.55,
        quote:
          '"솔직히 지금 경기력은 프로답지 못했습니다. 감독이 옷 벗기 전에 선수들부터 거울 보고 자기 몫을 돌아봐야 합니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 충격적인 공개 발언에 자존심이 긁힌 선수들이 오히려 독기를 품고 각성합니다!',
        },
        failEffect: {
          teamMoraleDelta: -2,
          reactionText:
            '❄️ "감독이 선수 탓을 한다"는 보도가 퍼지며 라커룸 내부에 불만이 싹트기 시작합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_05_transfer_rumor',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'transfer_rumor',
    title: '황당한 이적시장 찌라시 폭격',
    speakerLabel: '공식 기자회견 · 이적 전문 기자',
    prompt:
      '오늘 아침 "감독님이 스쿼드에 불만이 커서 다음 이적시장에서 절반을 갈아엎으려 한다"는 보도가 나왔습니다. 사실인가요?',
    choices: [
      {
        id: 'a',
        label: '유쾌한 찌라시 저격 드립',
        toneTag: '유쾌한 드립',
        quote:
          '"와, 그 기사 쓴 분 소설가로 전직하셔도 대박 나겠네요. 전 어제 우리 선수들이랑 단체로 저녁 먹고 디저트까지 나눠 먹었는데, 갈아엎긴 뭘 갈아엎습니까."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 재치 있는 일축에 이적 찌라시가 순식간에 잠잠해졌고 선수들도 안심하고 웃습니다.',
        },
      },
      {
        id: 'b',
        label: '100% 현 스쿼드 신뢰 선언',
        toneTag: '따뜻한 신뢰',
        quote:
          '"내 눈앞에 있는 이 16명이 세계 최고입니다. 구단주가 2억 유로를 쥐여줘도 지금 우리 팀 정신력을 바꿀 생각은 없습니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 감독의 절대적 신뢰 선언에 주전과 벤치 모두 자부심이 크게 올라갑니다.',
        },
      },
      {
        id: 'c',
        label: '은근한 긴장감 유지',
        toneTag: '프로의 세계',
        quote:
          '"축구는 경쟁의 세계죠. 오늘 잘하면 남는 거고, 안주하면 누구든 대체될 수 있습니다. 그게 빅클럽의 기준 아닙니까?"',
        successEffect: {
          starterMoraleDelta: 1,
          benchMoraleDelta: -1,
          reactionText:
            '📰 현실적인 발언에 주전들은 긴장감을 높였지만, 일부 백업 선수들은 불안감을 느낍니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_06_heavy_loss_aftermath',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'heavy_loss',
    title: '대패 직후 참담한 기자회견',
    speakerLabel: '경기 후 기자회견 · 현지 언론',
    prompt:
      '오늘 정말 뼈아픈 대패였습니다. 원정까지 따라온 팬들이 경기 종료 휘슬이 울리자 야유를 보냈는데, 팬들에게 어떤 말씀을 전하시겠습니까?',
    choices: [
      {
        id: 'a',
        label: '진심 어린 사과 & 복수 다짐',
        toneTag: '책임감',
        quote:
          '"비싼 티켓값 내고 와주신 팬들에게 부끄러운 경기였습니다. 야유는 100번 맞습니다. 변명은 안 하겠습니다. 다음 경기에서 이 빚, 두 배로 갚아드리겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          frozenReliefBonus: 1,
          reactionText:
            '📰 깔끔한 사과와 다짐에 팬심이 조금 누그러졌고, 선수들도 고개를 들고 다음 경기를 준비합니다.',
        },
      },
      {
        id: 'b',
        label: '무리뉴식 "1-0 세 번보다 3-0 한 번"',
        toneTag: '멘탈 방어',
        quote:
          '"1-0으로 세 번 지는 것보다 오늘처럼 한 번에 다 터지고 승점 3점만 잃는 게 낫습니다. 오늘 액땜 다 했으니 남은 시즌은 우리가 웃을 차례입니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 특유의 멘탈 케어 화법에 참담하던 라커룸의 자책감이 한결 줄어들었습니다.',
        },
      },
      {
        id: 'c',
        label: '분노의 "다시는 못 볼 경기력"',
        toneTag: '불호령',
        riskLabel: '하이리스크 (50%)',
        successChance: 0.5,
        quote:
          '"오늘 경기장은 우리 팀이 아니라 유령 11명이 뛰는 줄 알았습니다. 이 굴욕을 잊는 선수는 내 스쿼드에 필요 없습니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 뼈아픈 일침이 선수들의 가슴을 찔렀습니다. 라커룸에서 자발적인 미팅이 열리며 반격을 다짐합니다!',
        },
        failEffect: {
          teamMoraleDelta: -2,
          reactionText:
            '❄️ 대패의 충격에 감독의 혹평까지 겹치자 팀 전체 분위기가 꽁꽁 얼어붙습니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_07_big_win_party',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'big_win',
    title: '화끈한 대승 직후 극찬 세례',
    speakerLabel: '경기 후 기자회견 · 중계 방송사',
    prompt:
      '압도적인 대승이었습니다! 팬들은 "마치 전성기 바르사와 리버풀을 섞어놓은 것 같다"며 열광 중인데, 오늘 경기력에 몇 점을 주시겠습니까?',
    choices: [
      {
        id: 'a',
        label: '펩식 완벽주의 + 은근한 자랑',
        toneTag: '전술 집착',
        quote:
          '"10점 만점에 8.5점? 솔직히 후반 72분에 빌드업 각도가 2미터 틀어져서 좀 화났습니다. 농담이고, 선수들이 오늘 예술 작품을 그렸습니다. So happy, more than you believe!"',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 펩 못지않은 위트와 극찬에 선수들이 활짝 웃으며 최고의 자신감을 얻습니다.',
        },
      },
      {
        id: 'b',
        label: '팀원 전원에게 공 돌리기',
        toneTag: '팀워크 강조',
        quote:
          '"골 넣은 선수도 멋졌지만, 벤치에서 물병 들고 목 터져라 응원한 선수들이 진짜 MVP입니다. 오늘 승리는 16명 전원의 작품입니다."',
        successEffect: {
          teamMoraleDelta: 1,
          benchMoraleDelta: 1,
          reactionText:
            '🔥 벤치 멤버들까지 챙기는 따뜻한 인터뷰에 스쿼드 결속력이 단단해집니다.',
        },
      },
      {
        id: 'c',
        label: '안첼로티식 회식 선언',
        toneTag: '유쾌한 포상',
        quote:
          '"오늘 경기력? 굳이 분석할 필요 있나요. 오늘 밤 회식비 구단 법인카드로 제가 긁겠습니다. 단, 내일 오전 회복 훈련 지각하면 제가 직접 뛰게 할 겁니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 법인카드 회식 소식에 라커룸이 축제 분위기로 변합니다!',
        },
      },
    ],
  },
  {
    id: 'pc_team_08_ucl_or_cup_pressure',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'cup_or_ucl',
    title: '토너먼트 빅매치 전야 기자회견',
    speakerLabel: '공식 기자회견 · 유럽 축구 기자단',
    prompt:
      '단 한 번의 실수도 용납되지 않는 토너먼트 맞대결입니다. 상대 {opponentName}의 경험이 한 수 위라는 평가가 많은데, 부담스럽지 않으신가요?',
    choices: [
      {
        id: 'a',
        label: '클롭식 "즐기는 놈이 이긴다"',
        toneTag: '뜨거운 열정',
        quote:
          '"부담이요? 이런 밤을 위해 평생 축구한 겁니다! 조명 켜지고 관중석 터질 듯한 이 분위기, 소름 돋지 않나요? {opponentName}의 경험? 우리 패기로 다 찢어놓겠습니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 감독의 뜨거운 연설에 선수들이 긴장감 대신 짜릿한 설렘을 안고 경기장으로 향합니다.',
        },
      },
      {
        id: 'b',
        label: '치밀한 전술 준비 어필',
        toneTag: '냉철한 자신감',
        quote:
          '"{opponentName}의 최근 10경기 세트피스 패턴까지 다 외웠습니다. 경험은 과거일 뿐이고, 내일 경기장에서 뛰는 건 현재의 준비된 팀입니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'DF_GK',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 철저한 준비성에 수비진과 팀 전체가 든든한 자신감을 품습니다.',
        },
      },
      {
        id: 'c',
        label: '승부차기까지 여유 드립',
        toneTag: '여유 만만',
        quote:
          '"90분 안에 끝내면 제일 좋겠지만, 만약 승부차기까지 가면 우리 키커들 멘탈이 강철이라 오히려 환영입니다. 상대 키퍼가 좀 피곤하겠네요."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 여유 넘치는 도발에 상대 진영이 살짝 신경전을 벌이고, 우리 팀은 미소를 짓습니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_09_title_race_six_pointer',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'title_race',
    title: '우승 향방 가르는 승점 6점짜리 혈투',
    speakerLabel: '빅매치 기자회견 · 메인 브로드캐스터',
    prompt:
      '현재 {rank}위 자리에서 우승 경쟁팀 {opponentName}과 정면충돌합니다. 현지에서는 사실상의 결승전이라고 부르는데, 비겨도 만족하시나요?',
    choices: [
      {
        id: 'a',
        label: '승리 외엔 선택지 없다',
        toneTag: '공격적 선언',
        quote:
          '"무승부 노리고 경기장 들어가면 십중팔구 89분에 극장골 먹고 집 갑니다. 우린 승점 1점이 아니라 3점 뺏으러 갑니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'FW',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 화끈한 필승 선언에 공격수들의 눈빛이 번뜩입니다!',
        },
      },
      {
        id: 'b',
        label: '실리적인 마라톤 관점',
        toneTag: '차분한 관리',
        quote:
          '"시즌은 100미터 달리기가 아니라 마라톤입니다. 흥분해서 페이스 무너뜨리면 안 되죠. 똑똑하게, 차갑게 경기 운영하겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'MF',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 중원 라인이 차분하게 경기 템포를 설계할 준비를 마칩니다.',
        },
      },
      {
        id: 'c',
        label: '상대에게 압박 떠넘기기',
        toneTag: '심리전',
        quote:
          '"우승 못 하면 망하는 건 {opponentName} 쪽 아닌가요? 우리는 잃을 게 없고, 저쪽은 지금 다리가 떨리고 있을 겁니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 교묘한 심리전에 선수들의 어깨가 한결 가벼워집니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_10_unbeaten_pressure',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'unbeaten_run',
    title: '무패 행진의 무게',
    speakerLabel: '공식 기자회견 · 축구 칼럼니스트',
    prompt:
      '최근 {streak}경기 연속 무패 행진 중입니다! 기록이 길어질수록 "언제 깨질까" 하는 압박감이 커질 텐데, 선수단 분위기는 어떤가요?',
    choices: [
      {
        id: 'a',
        label: '기록보다 과정에 집중',
        toneTag: '멘탈 보호',
        quote:
          '"무패 기록은 깨지라고 있는 겁니다. 기록 지키려고 뒤로 숨는 순간 재미없는 축구가 되죠. 깨지든 말든 우리답게 몰아붙일 겁니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '🔥 기록에 대한 강박을 털어낸 선수들이 훨씬 자유롭게 훈련장을 누빕니다.',
        },
      },
      {
        id: 'b',
        label: '아스널 무패우승급 야망',
        toneTag: '역사 도전',
        riskLabel: '하이리스크 (65%)',
        successChance: 0.65,
        quote:
          '"황금 트로피 꿈꾸는 게 죄는 아니잖아요? 이왕 안 지고 있는 거, 상대 팀들이 우리 이름만 봐도 한숨 쉬게 끝까지 가보죠!"',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 "황금 트로피" 발언에 라커룸 전체가 거대한 자부심으로 들끓습니다!',
        },
        failEffect: {
          teamMoraleDelta: -1,
          reactionText:
            '❄️ 너무 큰 목표가 언급되자 일부 선수들이 실수에 대한 부담감을 느끼기 시작합니다.',
        },
      },
      {
        id: 'c',
        label: '무패 비결 = 유쾌한 농담',
        toneTag: '유쾌한 드립',
        quote:
          '"비결이요? 제가 경기 전에 매번 똑같은 양말 신고 나오는 징크스 때문입니다. 물론 세탁은 합니다, 오해 마세요."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 기자회견장이 웃음바다가 되며 무패 행진의 긴장감이 깔끔하게 풀렸습니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_11_comeback_drama',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'comeback_win',
    title: '극장 역전승의 밤',
    speakerLabel: '경기 후 기자회견 · 현장 리포터',
    prompt:
      '먼저 실점하고도 끝내 경기를 뒤집어 버렸습니다! 벤치에서 지켜보시면서 심장이 괜찮으셨나요?',
    choices: [
      {
        id: 'a',
        label: '퍼거슨 타임 감성 극찬',
        toneTag: '위닝 멘탈리티',
        quote:
          '"솔직히 수명이 3년은 줄어든 것 같습니다. 근데 이게 바로 위닝 멘탈리티죠. 종료 휘슬 울리기 전까지 우리 팀은 절대 죽지 않습니다!"',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 "절대 죽지 않는 팀" — 선수들이 스스로의 역전 DNA에 강한 확신을 갖습니다!',
        },
      },
      {
        id: 'b',
        label: '심장 건강 드립 + 감사',
        toneTag: '유쾌한 드립',
        quote:
          '"선수들한테 다음엔 제발 전반전에 편하게 끝내달라고 부탁했습니다. 구단 주치의가 내 혈압약을 두 배로 늘렸거든요. 그래도 끝까지 포기 안 한 선수들이 너무 자랑스럽습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 유쾌한 소감에 선수들이 깔깔 웃으며 끈끈한 동료애를 다집니다.',
        },
      },
      {
        id: 'c',
        label: '선제 실점 보완 강조',
        toneTag: '냉철한 피드백',
        quote:
          '"역전은 짜릿했지만, 애초에 선제골을 너무 쉽게 줬습니다. 기분은 오늘 밤만 즐기고 내일은 수비 집중력부터 다시 점검하겠습니다."',
        successEffect: {
          secondaryGroup: 'DF_GK',
          secondaryGroupDelta: 1,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 들뜨지 않는 명장의 태도에 수비진이 고개를 끄덕이며 집중력을 다잡습니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_12_referee_controversy',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'any',
    title: '심판 판정 논란 & VAR 질문',
    speakerLabel: '경기 후 기자회견 · 기자단',
    prompt:
      '최근 리그 전반적으로 애매한 VAR 판정이 잦다는 불만이 큽니다. 감독님도 경기 중 대기심과 언쟁하는 장면이 잡혔는데, 심판진에 하실 말씀이 있나요?',
    choices: [
      {
        id: 'a',
        label: '무리뉴식 명언 오마주',
        toneTag: '능청 풍자',
        quote:
          '"말하면 제 지갑에서 벌금이 나갑니다. 그 돈으로 차라리 우리 선수들 스테이크 사 먹이는 게 이득이죠. VAR 모니터 해상도가 좀 좋아졌으면 좋겠다는 덕담만 남기겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 뼈 있는 유머에 팬들이 열광하고 선수들도 통쾌해합니다.',
        },
      },
      {
        id: 'b',
        label: '실력으로 판정까지 압도 선언',
        toneTag: '정공법',
        quote:
          '"판정 하나에 휘둘릴 정도로 아슬아슬하게 이기면 안 됩니다. 심판이 뭘 보든 상관없이 3골 차이로 압도하면 끝날 일입니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'FW',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 당당한 태도에 공격수들이 더욱 화끈한 득점을 다짐합니다.',
        },
      },
      {
        id: 'c',
        label: '강력한 공개 항의',
        toneTag: '투쟁심',
        riskLabel: '하이리스크 (60%)',
        successChance: 0.6,
        quote:
          '"우리 선수들이 목숨 걸고 뛰는데 오심 하나로 노력 물거품 되는 건 못 참습니다. 협회도 좀 각성해야 합니다!"',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 선수들을 위해 총대를 멘 감독의 기백에 라커룸 충성도가 폭발합니다!',
        },
        failEffect: {
          teamMoraleDelta: -1,
          reactionText:
            '❄️ 징계 논란이 길어지며 다음 경기 준비 분위기가 약간 어수선해집니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_13_tactic_predictable',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'any',
    title: '전술 단조로움 지적',
    speakerLabel: '전술 분석 방송 · 패널 기자',
    prompt:
      '일부 전술 분석가들이 "{teamName}의 패턴이 이제 상대 팀들에 읽히기 시작했다"고 지적합니다. 플랜 B를 준비 중이신가요?',
    choices: [
      {
        id: 'a',
        label: '펩식 전술 자부심',
        toneTag: '전술 확신',
        quote:
          '"알고도 못 막는 게 진짜 무서운 전술입니다. 로벤이 왼쪽으로 접는 거 전 세계가 10년 동안 알았어도 못 막았잖아요? 물론 상대가 깜짝 놀랄 플랜 B도 주머니에 넣어뒀습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'MF',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 "알고도 못 막는 전술" 비유에 중원 지휘관들이 자신감을 얻습니다.',
        },
      },
      {
        id: 'b',
        label: '상대 분석가 낚시 드립',
        toneTag: '연막 작전',
        quote:
          '"오, 다 읽혔다니 다행이네요. 다음 경기엔 골키퍼를 최전방에 세우는 파격 전술을 써볼까 합니다. 분석가분들 오늘 밤 야근 좀 하시겠어요."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 넉살 좋은 농담에 기자들이 웃음을 터뜨렸고, 팀의 긴장도 사르르 녹습니다.',
        },
      },
      {
        id: 'c',
        label: '유연한 변화 선언',
        toneTag: '전술 유연성',
        quote:
          '"좋은 지적입니다. 우리 스쿼드엔 다양한 스타일의 선수들이 많습니다. 다음 {opponentName}전엔 전혀 다른 리듬을 보시게 될 겁니다."',
        successEffect: {
          teamMoraleDelta: 1,
          benchMoraleDelta: 1,
          reactionText:
            '🔥 전술 변화 예고에 벤치의 조커 자원들까지 기대감을 품고 훈련 강도를 높입니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_14_home_atmosphere',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'any',
    title: '홈 구장 열기와 팬들의 응원',
    speakerLabel: '사전 기자회견 · 지역지 기자',
    prompt:
      '요즘 {teamName} 홈 경기가 연일 매진입니다. 팬들의 기대치가 하늘을 찌르고 있는데, 선수들에게 부담으로 작용하지 않을까요?',
    choices: [
      {
        id: 'a',
        label: '클롭식 12번째 선수 찬가',
        toneTag: '팬심 폭발',
        quote:
          '"부담이라뇨, 그 함성은 우리 팀 무료 에너지 드링크입니다! 관중석이 흔들릴수록 우리 선수들은 10미터 더 뜁니다. 내일도 목 쉴 각오로 와주세요!"',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 팬들과 선수단 사이의 유대감이 한층 더 뜨거워졌습니다!',
        },
      },
      {
        id: 'b',
        label: '화려한 경기력 약속',
        toneTag: '엔터테이너',
        quote:
          '"팬들이 주중 내내 힘들게 일하고 주말에 구장 오시는데 지루한 0-0 보여드리면 죄짓는 거죠. 눈이 즐거운 축구로 보답하겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'FW',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 공격적인 약속에 선수들이 신나서 훈련장 분위기가 활기차집니다.',
        },
      },
      {
        id: 'c',
        label: '차분한 경기 집중 당부',
        toneTag: '침착함',
        quote:
          '"팬들의 응원은 너무 감사하지만, 경기장 안에선 뜨겁되 머리는 차가워야 합니다. 흥분하지 않고 냉정하게 승점을 따내겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 프로페셔널한 태도에 선수들이 들뜨지 않고 경기 준비에 몰입합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_15_style_criticism',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'any',
    title: '경기 스타일 논쟁 ("결과 vs 재미")',
    speakerLabel: '공식 기자회견 · 해설위원 출신 기자',
    prompt:
      '최근 경기에서 점유율보다 실리를 택하는 장면이 많았습니다. "예쁜 축구가 아니다"라는 비평에 대해 어떻게 생각하시나요?',
    choices: [
      {
        id: 'a',
        label: '무리뉴식 실리주의 일침',
        toneTag: '실리 명언',
        quote:
          '"예쁜 축구 보고 싶으시면 발레 공연장 가셔야죠. 여기는 승점 3점 싸움하는 정글입니다. 이기는 축구가 세상에서 제일 예쁜 축구입니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'DF_GK',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 단호한 승부사 철학에 수비진과 선수단이 강한 자부심을 느낍니다.',
        },
      },
      {
        id: 'b',
        label: '안첼로티식 유연한 명답',
        toneTag: '명장의 품격',
        quote:
          '"좋은 요리사는 냉장고에 있는 재료에 맞춰 최고의 요리를 냅니다. 매번 똑같은 레시피만 고집하는 건 고집이지 철학이 아니에요. 우린 이길 수 있는 모든 방식을 씁니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 명언 제조기다운 답변에 기자회견장에서 박수가 터져 나왔고 선수들도 감탄합니다.',
        },
      },
      {
        id: 'c',
        label: '화려한 공격 축구 예고',
        toneTag: '공격 본능',
        quote:
          '"재미있는 축구 원하시나요? 좋습니다. 다음 경기엔 상대 수비수들 어지럼증 올 정도로 몰아붙여 드리죠."',
        successEffect: {
          secondaryGroup: 'FW',
          secondaryGroupDelta: 2,
          reactionText:
            '🔥 공격진에 프리롤 기대감이 번지며 사기가 크게 상승합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_16_away_curse',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'big_match',
    title: '원정 경기 지옥 원정길 앞둔 각오',
    speakerLabel: '원정 사전 기자회견 · 원정지 기자',
    prompt:
      '{opponentName}의 홈 구장은 원정팀의 무덤으로 불립니다. 5만 관중의 야유 속에서 선수들이 흔들리지 않을까요?',
    choices: [
      {
        id: 'a',
        label: '야유를 음악처럼 즐겨라',
        toneTag: '강심장',
        quote:
          '"야유 소리 크면 클수록 우리가 위협적이라는 증거죠. 우리 선수들한텐 그 야유가 최고의 BGM입니다. 오히려 조용하면 심심할걸요?"',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 당당한 멘탈 세팅에 원정길 선수단의 표정이 한결 단단해집니다.',
        },
      },
      {
        id: 'b',
        label: '원정 서포터즈 언급',
        toneTag: '감동 케어',
        quote:
          '"5만 명이 야유해도 구석에서 목 터져라 응원해 줄 우리 원정 팬 3천 명 목소리가 더 크게 들릴 겁니다. 그분들 기분 좋게 귀가시켜 드리겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '🔥 원정 팬을 챙기는 따뜻한 한마디에 선수들이 책임감과 의욕을 다집니다.',
        },
      },
      {
        id: 'c',
        label: '선제골로 조기 진압 예고',
        toneTag: '기선 제압',
        quote:
          '"전반 15분 안에 한 골만 박아 넣으면 5만 명 야유가 3초 만에 탄식으로 바뀝니다. 초반부터 강하게 때리겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          secondaryGroup: 'FW',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 초반 기선 제압 전략에 공격수들이 전투 태세에 돌입합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_17_season_fatigue_mindset',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'any',
    title: '시즌 중후반 승부처 진입',
    speakerLabel: '공식 기자회견 · 리그 매거진',
    prompt:
      '시즌이 점점 승부처로 향하고 있습니다. 순위표가 매일 요동치는데, 감독님이 가장 중요하게 보는 포인트는 무엇인가요?',
    choices: [
      {
        id: 'a',
        label: '원팀 멘탈리티 강조',
        toneTag: '결속력',
        quote:
          '"결국 마지막에 웃는 팀은 제일 비싼 팀이 아니라, 힘들 때 옆 사람 대신 한 발 더 뛰어주는 팀입니다. 지금 우리 라커룸 분위기? 돈 주고도 못 삽니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 라커룸을 치켜세운 인터뷰에 선수들 사이의 신뢰가 더욱 끈끈해집니다.',
        },
      },
      {
        id: 'b',
        label: '순위표 안 본다 드립',
        toneTag: '여유 유머',
        quote:
          '"솔직히 저 순위표 앱 지웠습니다. 자꾸 보면 밤에 잠 안 오거든요. 그냥 눈앞의 {opponentName}전만 이기다 보면 좋은 자리에 가 있겠죠."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 유쾌한 마인드 컨트롤에 선수들도 순위 압박에서 벗어나 웃습니다.',
        },
      },
      {
        id: 'c',
        label: '체력·부상 관리 최우선 선언',
        toneTag: '현실적 운영',
        quote:
          '"지금부턴 스쿼드 16명 전원의 싸움입니다. 부상 없이 끝까지 살아남는 팀이 트로피를 듭니다. 모든 선수에게 기회가 갈 겁니다."',
        successEffect: {
          benchMoraleDelta: 2,
          reactionText:
            '🔥 로테이션 기용 의지에 벤치 선수들의 사기가 눈에 띄게 올라갑니다.',
        },
      },
    ],
  },
  {
    id: 'pc_team_18_media_mindgames',
    category: 'press_conference',
    targetScope: 'team',
    trigger: 'any',
    title: '언론의 우승 후보 저평가',
    speakerLabel: '공식 기자회견 · 데이터 분석 기자',
    prompt:
      '슈퍼컴퓨터 예측 모델에서 {teamName}의 우승 확률이 경쟁팀보다 낮게 나왔습니다. 데이터 분석 결과를 어떻게 보시나요?',
    choices: [
      {
        id: 'a',
        label: '슈퍼컴퓨터 저격 유머',
        toneTag: '유쾌한 드립',
        quote:
          '"그 슈퍼컴퓨터가 축구화 신고 잔디 밟아본 적 있나요? 아마 태클 한 번 맞으면 블루스크린 뜰 겁니다. 우리는 데이터 찢어먹는 맛으로 축구합니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 "슈퍼컴퓨터 블루스크린" 드립이 인터넷을 강타하며 선수들이 통쾌하게 사기를 끌어올립니다!',
        },
      },
      {
        id: 'b',
        label: '오히려 좋아 — 동기부여 활용',
        toneTag: '언더독 투지',
        quote:
          '"그 예측표 출력해서 라커룸 문짝에 붙여 놓겠습니다. 우리 선수들이 무시당하는 걸 제일 싫어하거든요. 동기부여 공짜로 주셔서 감사합니다."',
        successEffect: {
          teamMoraleDelta: 2,
          reactionText:
            '🔥 라커룸 벽에 붙은 저평가 기사를 보며 선수들의 승부욕이 불타오릅니다.',
        },
      },
      {
        id: 'c',
        label: '차분한 수용',
        toneTag: '냉정함',
        quote:
          '"확률은 확률일 뿐이죠. 낮은 확률을 뒤집는 게 스포츠가 재밌는 이유 아닙니까? 묵묵히 경기력으로 증명하겠습니다."',
        successEffect: {
          teamMoraleDelta: 1,
          reactionText:
            '📰 차분한 대응에 선수단도 흔들림 없이 훈련에 집중합니다.',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // B. POSITION-GROUP PRESS CONFERENCES (8)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'pc_pos_01_fw_xg_drought',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'FW',
    trigger: 'xg_underperform',
    title: '공격진 결정력 논란 질문',
    speakerLabel: '경기 후 기자회견 · 스포츠 기자',
    prompt:
      '경기력은 좋았는데 공격수들이 결정적 찬스를 여러 번 놓쳤습니다. 일각에서는 "{teamName} 공격진이 골대랑 낯을 가린다"는 혹평도 나오는데 어떻게 보시나요?',
    choices: [
      {
        id: 'a',
        label: '공격진 전폭 옹호 (케첩병 드립)',
        toneTag: '따뜻한 방패',
        quote:
          '"찬스를 못 만드는 게 문제지, 만들어 놓고 못 넣는 건 시간문제입니다. 골은 케첩병 같아서 한 번 터지면 감당 안 될 만큼 쏟아집니다. 우리 공격수들 믿으세요."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 감독의 굳건한 신뢰에 공격수들이 부담을 덜고 활짝 웃습니다.',
        },
      },
      {
        id: 'b',
        label: '솔직한 결정력 아쉬움 인정',
        toneTag: '공개 채찍질',
        riskLabel: '하이리스크 (60%)',
        successChance: 0.6,
        quote:
          '"솔직히 오늘 골문 앞에서 너무 착했습니다. 다음 경기엔 상대 골키퍼가 꿈에도 나오게 무자비하게 때려 넣어야 합니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 자존심이 자극된 공격수들이 추가 슈팅 훈련을 자청하며 독기를 품습니다!',
        },
        failEffect: {
          targetMoraleDelta: -2,
          reactionText:
            '❄️ 언론의 결정력 비판에 감독까지 동조하자 공격수들의 어깨가 무거워집니다.',
        },
      },
      {
        id: 'c',
        label: '팀 전체 득점 분산 강조',
        toneTag: '분위기 환기',
        quote:
          '"골은 공격수만 넣는 게 아니죠. 미드필더든 센터백이든 골문 근처면 다 때려도 됩니다. 공격수들한테만 짐 지우지 마세요."',
        successEffect: {
          targetMoraleDelta: 1,
          secondaryGroup: 'MF',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 공격수의 부담을 나누자 공격진과 미드필더진 모두 분위기가 좋아집니다.',
        },
      },
    ],
  },
  {
    id: 'pc_pos_02_df_clean_sheet',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'DF_GK',
    trigger: 'clean_sheet_streak',
    title: '통곡의 벽! 연속 무실점 수비진 극찬',
    speakerLabel: '경기 후 기자회견 · 축구 전문지',
    prompt:
      '최근 {streak}경기 연속 무실점입니다! 팬들이 우리 수비진과 골키퍼를 두고 "철벽 요새"라고 부르는데, 비결이 무엇인가요?',
    choices: [
      {
        id: 'a',
        label: '수비진·GK 특급 헌정 칭찬',
        toneTag: '극찬 포상',
        quote:
          '"골 넣은 공격수만 스포트라이트 받으면 억울하죠. 지금 우리 수비진과 골키퍼는 예술입니다. 상대 공격수들이 경기 끝나고 우리 수비수 주머니에서 걸어 나올 정도예요."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 "주머니에서 걸어 나온다"는 극찬에 수비진과 골키퍼의 자부심이 하늘을 찌릅니다!',
        },
      },
      {
        id: 'b',
        label: '전방 압박부터 시작되는 수비',
        toneTag: '팀 수비 강조',
        quote:
          '"수비는 최전방 공격수부터 시작됩니다. 물론 뒤에서 완벽하게 막아준 수비라인과 키퍼가 일등공신이죠. 팀 전체의 헌신 덕분입니다."',
        successEffect: {
          targetMoraleDelta: 1,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 수비진뿐 아니라 팀 전체가 조직력에 대한 확신을 갖습니다.',
        },
      },
      {
        id: 'c',
        label: '방심 경계 — "기록 깨지는 날이 온다"',
        toneTag: '긴장 유지',
        quote:
          '"칭찬은 고맙지만, 무실점 기록에 취하는 순간 어이없는 실점이 나옵니다. 다음 경기엔 0-0부터 다시 시작한다는 마음으로 집중하겠습니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 명장의 냉철한 경계에 수비진이 자만하지 않고 집중력을 유지합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_pos_03_df_conceded_many',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'DF_GK',
    trigger: 'conceded_many',
    title: '수비 불안 & 대량 실점 질타',
    speakerLabel: '경기 후 기자회견 · 현지 언론',
    prompt:
      '오늘 수비 라인이 너무 쉽게 뚫리며 실점이 많았습니다. 팬들 사이에서 "수비 조직력이 자동문 수준"이라는 거친 비판이 나오고 있습니다.',
    choices: [
      {
        id: 'a',
        label: '전술 라인 높이 내 책임 선언',
        toneTag: '감독 방패',
        quote:
          '"수비수들 욕하지 마세요. 공격적으로 라인을 높게 올리라고 지시한 건 저입니다. 뒷공간이 열린 건 전술 리스크였고, 다음엔 간격을 더 촘촘히 조정하겠습니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 비난의 화살을 막아준 감독에게 수비진과 골키퍼가 깊이 감사하며 멘탈을 회복합니다.',
        },
      },
      {
        id: 'b',
        label: '수비 집중력 공개 경고',
        toneTag: '따끔한 채찍',
        riskLabel: '하이리스크 (55%)',
        successChance: 0.55,
        quote:
          '"솔직히 오늘 박스 안 마킹은 용납할 수 없는 수준이었습니다. 다음 경기엔 수비수들이 몸을 던져서라도 골문을 걸어 잠가야 합니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 따끔한 공개 질타에 수비수들이 자존심을 걸고 무실점 각오를 다집니다!',
        },
        failEffect: {
          targetMoraleDelta: -2,
          reactionText:
            '❄️ "자동문" 비판에 감독의 공개 질책까지 더해지자 수비진 분위기가 급격히 위축됩니다.',
        },
      },
      {
        id: 'c',
        label: '상대 공격력 인정 & 쿨한 전환',
        toneTag: '멘탈 방어',
        quote:
          '"상대가 원더골급 마무리를 보여준 장면도 있었습니다. 오늘 실점 영상은 깔끔하게 복기하고 털어내겠습니다. 우리 수비진 실력은 의심하지 않습니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 냉정하고 합리적인 대응에 수비진이 빠르게 마음을 추스릅니다.',
        },
      },
    ],
  },
  {
    id: 'pc_pos_04_mf_engine_praise',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'MF',
    trigger: 'any',
    title: '중원 지배력에 대한 언론의 극찬',
    speakerLabel: '공식 기자회견 · 전술 칼럼니스트',
    prompt:
      '요즘 {teamName} 경기를 보면 중원에서 공을 거의 뺏기지 않습니다. 상대 감독들이 "미드필드 싸움에서 숨이 막힌다"고 혀를 내두르더군요.',
    choices: [
      {
        id: 'a',
        label: '미드필더진 = 팀의 심장 극찬',
        toneTag: '라인 극찬',
        quote:
          '"축구는 결국 허리가 튼튼해야 서는 종목입니다. 우리 미드필더들은 패스 길만 보는 게 아니라 상대보다 두 배로 뛰거든요. 솔직히 내가 현역 때 저 친구들 만났으면 쥐 났을 겁니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 유쾌한 극찬에 미드필더진의 자신감과 활력이 폭발합니다!',
        },
      },
      {
        id: 'b',
        label: '전 포지션 유기적 움직임 덕분',
        toneTag: '팀 밸런스',
        quote:
          '"중원이 빛나는 건 공격수들이 공간을 열어주고 수비수들이 과감하게 전진 패스를 찔러주기 때문입니다. 팀 전체 톱니바퀴가 잘 맞고 있어요."',
        successEffect: {
          targetMoraleDelta: 1,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 중원과 전 포지션 모두 기분 좋게 팀워크를 확인합니다.',
        },
      },
      {
        id: 'c',
        label: '더 높은 전술 완성도 요구',
        toneTag: '펩식 욕심',
        quote:
          '"좋긴 한데 아직 만족 못 합니다. 전환 속도를 0.5초만 더 당기면 유럽 어떤 팀도 우리 중원을 못 당해낼 겁니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '🔥 높은 기준 제시에 미드필더진이 더욱 날카롭게 훈련에 몰두합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_pos_05_mf_physical_battle',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'MF',
    trigger: 'big_match',
    title: '{opponentName}의 거친 중원 압박 예고',
    speakerLabel: '사전 기자회견 · 현장 기자',
    prompt:
      '{opponentName} 미드필더들이 거친 몸싸움과 전방 압박으로 유명한데, 우리 중원이 피지컬 싸움에서 밀리지 않을까요?',
    choices: [
      {
        id: 'a',
        label: '기술과 패스로 농락 선언',
        toneTag: '기술 자부심',
        quote:
          '"몸싸움하려면 일단 우리 선수들을 잡아야죠. 원터치로 공이 휙휙 지나가면 허공에 태클만 하다 지칠 겁니다. 우리 중원 클래스 믿으세요."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 감독의 당당한 기술 찬사에 미드필더들이 웃으며 자신감을 채웁니다.',
        },
      },
      {
        id: 'b',
        label: '투지 맞불 — "우리도 안 물러난다"',
        toneTag: '기싸움 우위',
        quote:
          '"우리 미드필더들이 얌전해 보이나요? 경합 들어가면 절대 발 안 빼는 전사들입니다. 거칠게 나오면 우리도 똑같이 받아쳐 줄 겁니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 전사라는 표현에 미드필더진의 전투력이 수직 상승합니다!',
        },
      },
      {
        id: 'c',
        label: '심판에게 사전 눈치 주기',
        toneTag: '무리뉴식 압박',
        quote:
          '"거친 압박은 좋지만 정강이 노리는 반칙은 축구가 아니죠. 내일 주심께서 현명하게 선수들을 보호해 주실 거라 믿습니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 노련한 사전 언론 플레이에 미드필더들이 든든함을 느낍니다.',
        },
      },
    ],
  },
  {
    id: 'pc_pos_06_fw_scoring_machine',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'FW',
    trigger: 'big_win',
    title: '화력 폭발! 공격진 득점쇼 극찬',
    speakerLabel: '경기 후 기자회견 · 방송사 인터뷰',
    prompt:
      '오늘 공격진의 화력이 그야말로 불을 뿜었습니다! 상대 수비수들이 경기 후 넋이 나간 표정이었는데요?',
    choices: [
      {
        id: 'a',
        label: '공격진 화력 극찬',
        toneTag: '칭찬 폭격',
        quote:
          '"솔직히 벤치에서 보면서도 감탄했습니다. 이 정도 화력이면 상대 골키퍼는 위험수당 받아야 하는 거 아닌가요? 우리 공격수들 지금 감각이 미쳤습니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 "상대 키퍼 위험수당" 드립에 공격수들이 폭소하며 자신감이 하늘을 찌릅니다!',
        },
      },
      {
        id: 'b',
        label: '찬스 만들어준 중원·수비도 언급',
        toneTag: '균형 배려',
        quote:
          '"마무리도 환상적이었지만, 그 킬패스를 찔러준 미드필더와 빌드업해 준 수비진 덕분이죠. 팀 전체가 만든 골입니다."',
        successEffect: {
          targetMoraleDelta: 1,
          secondaryGroup: 'MF',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 공격진과 미드필더진 모두 기분 좋게 공을 나누며 시너지가 올라갑니다.',
        },
      },
      {
        id: 'c',
        label: '더 넣을 수 있었다는 여유 도발',
        toneTag: '야망 자극',
        quote:
          '"기분은 좋지만 2골은 더 넣을 수 있었습니다. 다음 {opponentName}전엔 아껴둔 골까지 다 털어 넣으라고 해뒀습니다."',
        successEffect: {
          targetMoraleDelta: 1,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 거침없는 화력 예고에 팀 전체가 기세등등해집니다.',
        },
      },
    ],
  },
  {
    id: 'pc_pos_07_df_set_piece_worry',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'DF_GK',
    trigger: 'any',
    title: '상대 세트피스 경계령 질문',
    speakerLabel: '사전 기자회견 · 기자단',
    prompt:
      '{opponentName}은 코너킥과 프리킥 득점 비율이 리그 최상위권입니다. 우리 수비진과 골키퍼가 제공권에서 고전할 거라는 전망이 많습니다.',
    choices: [
      {
        id: 'a',
        label: '수비진 제공권 전폭 신뢰',
        toneTag: '신뢰 부여',
        quote:
          '"우리 수비수들과 골키퍼가 공중볼 싸움에서 밀린다고요? 글쎄요, 훈련장에서 헤더 연습하는 거 보시면 그런 말씀 못 하실 겁니다. 100% 믿습니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 감독의 든든한 신뢰에 수비진과 골키퍼가 강한 자신감을 품습니다.',
        },
      },
      {
        id: 'b',
        label: '세트피스 전담 코칭 어필',
        toneTag: '디테일 강조',
        quote:
          '"이번 주 내내 세트피스 수비 동선만 세 번씩 맞췄습니다. 애초에 위험 지역에서 불필요한 파울을 안 주는 게 제일 깔끔한 해법이죠."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '🔥 명확한 해법 제시에 수비진이 차분하게 집중력을 다집니다.',
        },
      },
      {
        id: 'c',
        label: '오히려 우리가 세트피스로 역습',
        toneTag: '유쾌한 반격',
        quote:
          '"코너킥 걷어내고 5초 만에 역습으로 골 넣는 게 제일 맛있거든요. 상대가 코너킥 올릴 때마다 오히려 긴장해야 할 겁니다."',
        successEffect: {
          targetMoraleDelta: 1,
          secondaryGroup: 'FW',
          secondaryGroupDelta: 1,
          reactionText:
            '🔥 역습 시나리오에 수비진과 공격수 모두 눈이 반짝입니다.',
        },
      },
    ],
  },
  {
    id: 'pc_pos_08_mf_creativity_question',
    category: 'press_conference',
    targetScope: 'position_group',
    positionGroup: 'MF',
    trigger: 'xg_underperform',
    title: '중원 창의성 부족 지적',
    speakerLabel: '경기 후 기자회견 · 축구 기자',
    prompt:
      '상대가 밀집 수비를 펼쳤을 때 미드필더진에서 날카로운 킬패스가 부족했다는 평가가 있습니다. 창의성이 아쉽지 않으셨나요?',
    choices: [
      {
        id: 'a',
        label: '밀집 수비의 어려움 옹호',
        toneTag: '따뜻한 이해',
        quote:
          '"상대가 페널티박스 안에 버스 두 대를 주차해 놓으면 메시가 와도 좁습니다. 우리 미드필더들은 끝까지 침착하게 틈을 찾았고, 다음엔 그 틈을 정확히 뚫을 겁니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 "버스 두 대" 옹호에 미드필더진이 위로를 얻고 자신감을 되찾습니다.',
        },
      },
      {
        id: 'b',
        label: '과감한 모험 패스 주문',
        toneTag: '공격적 독려',
        quote:
          '"안전한 횡패스만 돌리면 실수는 없지만 골도 안 납니다. 공 뺏겨도 좋으니 과감하게 전진 패스 찌르라고 주문했습니다. 우리 중원엔 그럴 재능이 충분합니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 실수를 두려워 말라는 허락에 미드필더진의 창의성이 깨어납니다!',
        },
      },
      {
        id: 'c',
        label: '중원 템포 개선 공개 압박',
        toneTag: '날 선 요구',
        riskLabel: '하이리스크 (60%)',
        successChance: 0.6,
        quote:
          '"맞습니다, 오늘 패스 템포가 한 박자 느렸어요. 미드필더들이 더 과감하고 영리하게 움직여야 합니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 직설적인 피드백에 자극받은 미드필더진이 다음 경기 맹활약을 다짐합니다.',
        },
        failEffect: {
          targetMoraleDelta: -2,
          reactionText:
            '❄️ 공개적인 창의성 지적에 미드필더들이 다소 위축된 표정을 짓습니다.',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // C. INDIVIDUAL PLAYER PRESS CONFERENCES (10)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'pc_plr_01_mom_superstar',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'player_mom_or_hattrick',
    title: '{playerName}의 원맨쇼에 쏟아진 극찬',
    speakerLabel: '경기 후 기자회견 · 방송사 기자',
    prompt:
      '오늘 {playerName} 선수의 활약은 그야말로 경이로웠습니다! 현지 팬들 사이에서 벌써 "발롱도르 줘야 한다"는 반응이 쏟아지는데 어떻게 보시나요?',
    choices: [
      {
        id: 'a',
        label: '명장급 특급 찬사',
        toneTag: '최고의 찬사',
        quote:
          '"솔직히 돈 내고 입장권 사서 봐야 할 클래스였습니다. {playerName}이(가) 저 컨디션이면 상대 수비수들은 그냥 사인이나 미리 받아두는 게 나을 겁니다."',
        successEffect: {
          targetMoraleDelta: 3,
          reactionText:
            '🔥 감독의 역대급 극찬을 전해 들은 {playerName}이(가) 함박웃음을 지으며 기세가 하늘을 찌릅니다!',
        },
      },
      {
        id: 'b',
        label: '칭찬 + 팀원들과의 조화 강조',
        toneTag: '균형 리더십',
        quote:
          '"{playerName}이(가) 정말 눈부셨습니다. 그리고 그 뒤에서 궂은일 해준 동료들 덕분에 더 빛났죠. 이 시너지가 우리 팀의 진짜 무기입니다."',
        successEffect: {
          targetMoraleDelta: 2,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 {playerName}과(와) 팀 동료들 모두 기분 좋게 서로를 치켜세웁니다.',
        },
      },
      {
        id: 'c',
        label: '안첼로티식 귀여운 겸손 브레이크',
        toneTag: '유쾌한 절제',
        quote:
          '"잘하긴 했는데 너무 띄워주지 마세요. 내일 훈련장 와서 어깨 올라가 있으면 제가 뛰게 해야 되거든요. 농담이고, 정말 환상적이었습니다!"',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 유쾌한 농담에 {playerName}이(가) 씩 웃으며 더 좋은 활약을 다짐합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_02_poor_rating_criticism',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'player_poor_rating',
    title: '{playerName}의 충격 부진 논란',
    speakerLabel: '경기 후 기자회견 · 타블로이드 기자',
    prompt:
      '오늘 {playerName} 선수가 최악의 경기력을 보였습니다. 팬 평점이 5점대까지 떨어졌는데, 다음 경기 선발에서 제외하실 건가요?',
    choices: [
      {
        id: 'a',
        label: '철벽 방패 — "내 선수 건드리지 마"',
        toneTag: '전폭 옹호',
        quote:
          '"누구나 안 풀리는 하루가 있습니다. 90분 하나로 {playerName}의 클래스를 의심하는 건 축구 모르는 소리죠. 다음 경기 선발? 고민도 안 합니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 최악의 날에 감독이 온몸으로 감싸주자 {playerName}이(가) 깊이 감동하며 빠르게 멘탈을 회복합니다.',
        },
      },
      {
        id: 'b',
        label: '무리뉴식 공개 압박 (충격 요법)',
        toneTag: '공개 채찍질',
        riskLabel: '하이리스크 (55%)',
        successChance: 0.55,
        quote:
          '"오늘 {playerName}의 경기력은 본인도 부끄러워할 겁니다. 이름값으로 선발 보장되는 시대는 끝났어요. 훈련장에서 피 토할 각오로 증명해야 합니다."',
        successEffect: {
          targetMoraleDelta: 3,
          reactionText:
            '🔥 충격적인 공개 채찍질에 {playerName}이(가) 독기를 품고 야간 개인 훈련에 돌입합니다! (각성!)',
        },
        failEffect: {
          targetMoraleDelta: -2,
          reactionText:
            '❄️ 언론 앞 공개 저격에 {playerName}이(가) 큰 상처를 입고 감독과 거리를 두기 시작합니다.',
        },
      },
      {
        id: 'c',
        label: '쿨한 전술 핑계로 시선 돌리기',
        toneTag: '노련한 회피',
        quote:
          '"오늘 상대가 {playerName}만 집중 견제하도록 덫을 짰더군요. 사실 전술적으로 미끼 역할을 잘해준 겁니다. 겉으로 보이는 평점만 보면 안 됩니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 교묘한 언론 플레이로 비판 여론이 잦아들며 {playerName}이(가) 안도의 한숨을 쉽니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_03_goal_drought',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'player_goal_drought',
    title: '{playerName}의 길어지는 무득점 행진',
    speakerLabel: '사전 기자회견 · 스포츠 기자',
    prompt:
      '{playerName} 선수가 벌써 몇 경기째 침묵 중입니다. 스트라이커가 골을 못 넣으면 자신감이 바닥을 칠 텐데, 걱정되지 않으신가요?',
    choices: [
      {
        id: 'a',
        label: '헌신적 움직임 극찬 & 신뢰',
        toneTag: '따뜻한 신뢰',
        quote:
          '"골 숫자만 보지 마세요. {playerName}이(가) 상대 센터백 두 명을 끌고 다녀준 덕분에 팀 전체가 살아납니다. 한 골만 터지면 댐 무너지듯 쏟아질 겁니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 감독이 보이지 않는 헌신을 알아주자 {playerName}의 표정이 환하게 밝아집니다.',
        },
      },
      {
        id: 'b',
        label: '유머러스한 내기 선언',
        toneTag: '유쾌한 드립',
        quote:
          '"어제 훈련 끝나고 {playerName}이랑 내기했습니다. 다음 경기 골 넣으면 제가 최고급 저녁 쏘고, 못 넣으면 본인이 팀 전원 커피 돌리기로요. 아마 제 지갑 털릴 겁니다."',
        successEffect: {
          targetMoraleDelta: 2,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 유쾌한 커피 내기 이야기에 {playerName}이(가) "감독님 카드 준비하세요!"라며 웃습니다.',
        },
      },
      {
        id: 'c',
        label: '냉정한 득점 요구',
        toneTag: '프로의 압박',
        riskLabel: '하이리스크 (60%)',
        successChance: 0.6,
        quote:
          '"공격수는 결국 골로 말하는 자리입니다. {playerName}도 그걸 누구보다 잘 알고 있고, 이제는 결과물로 답할 때가 됐습니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 정면 돌파 메시지에 {playerName}의 눈빛이 매섭게 살아납니다!',
        },
        failEffect: {
          targetMoraleDelta: -2,
          reactionText:
            '❄️ 득점 압박이 더해지며 {playerName}이(가) 골문 앞에서 더욱 조급해합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_04_bench_rumor',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'player_bench_unhappy',
    title: '{playerName}의 출전 시간 불만설',
    speakerLabel: '공식 기자회견 · 가십 전문 기자',
    prompt:
      '{playerName} 선수가 최근 연속 벤치 대기에 불만을 품고 에이전트와 접촉했다는 루머가 돌고 있습니다. 관계에 문제가 있나요?',
    choices: [
      {
        id: 'a',
        label: '진심 어린 존중 & 곧 기회 약속',
        toneTag: '신뢰 회복',
        quote:
          '"경기에 못 나가면 화가 나는 게 정상입니다! 벤치 앉아서 행복해하는 선수는 프로가 아니죠. {playerName}은(는) 우리 핵심 전력이고, 곧 중요한 역할을 맡게 될 겁니다."',
        successEffect: {
          targetMoraleDelta: 3,
          reactionText:
            '🔥 공개적인 존중과 기용 예고에 {playerName}의 불만이 눈 녹듯 사라지며 의욕이 치솟습니다!',
        },
      },
      {
        id: 'b',
        label: '에이전트 저격 유머',
        toneTag: '능청 유머',
        quote:
          '"에이전트들이 일 없으면 기자님들한테 전화해서 커피 마시는 게 직업이죠. {playerName}이랑 저는 방금도 웃으면서 농담 따먹기 했습니다. 걱정 붙들어 매세요."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 넉살 좋은 해명에 불화설이 잠잠해졌고 {playerName}도 가볍게 웃어넘깁니다.',
        },
      },
      {
        id: 'c',
        label: '단호한 팀 우선 원칙',
        toneTag: '기강 확립',
        quote:
          '"어떤 선수도 구단보다 클 수 없습니다. 선발 자리는 언론 플레이가 아니라 훈련장 땀방울로 따내는 겁니다."',
        successEffect: {
          targetMoraleDelta: -1,
          teamMoraleDelta: 1,
          reactionText:
            '📰 팀 기강은 단단해졌지만, {playerName}은(는) 서운한 기색을 감추지 못합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_05_ace_big_match',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'player_big_game_ace',
    title: '빅매치 키플레이어 {playerName} 집중 조명',
    speakerLabel: '빅매치 기자회견 · 중계진',
    prompt:
      '{opponentName} 감독이 "경기 승패는 {playerName}을(를) 어떻게 묶느냐에 달렸다"며 2인 전담 마크를 예고했습니다. 대응책이 있나요?',
    choices: [
      {
        id: 'a',
        label: '절대 에이스 추켜세우기',
        toneTag: '자존감 폭발',
        quote:
          '"두 명 붙여도 모자랄걸요? 세 명 붙이셔도 됩니다. 그럼 우리 다른 선수 두 명이 텅 빈 공간에서 산책하겠죠. {playerName}은(는) 그런 압박을 즐기는 월드클래스입니다."',
        successEffect: {
          targetMoraleDelta: 2,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 감독의 묵직한 한마디에 {playerName}의 눈빛이 자신감으로 번뜩입니다!',
        },
      },
      {
        id: 'b',
        label: '연막 작전 유머',
        toneTag: '능청 도발',
        quote:
          '"어이쿠, 전담 마크 준비하셨다니 어쩌죠? 내일 {playerName}한테 가짜 등번호 입혀서 내보낼까 고민 중입니다. 상대 수비수들 좀 헷갈리겠네요."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 재치 있는 농담에 빅매치 전 긴장감이 기분 좋게 풀렸습니다.',
        },
      },
      {
        id: 'c',
        label: '에이스의 책임감 자극',
        toneTag: '큰 경기 요구',
        quote:
          '"슈퍼스타라면 2명 마크쯤은 뚫어내야 진짜죠. 내일이 바로 {playerName}이(가) 왜 최고인지 전 세계에 보여줄 무대입니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 거대한 기대감에 {playerName}이(가) "기대하셔도 좋습니다"라며 투지를 다집니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_06_injury_return',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'player_returning_injury',
    title: '부상 털고 돌아온 {playerName} 복귀전',
    speakerLabel: '사전 기자회견 · 의료/스포츠 기자',
    prompt:
      '{playerName} 선수가 드디어 부상에서 회복해 스쿼드에 돌아왔습니다! 팬들이 열렬히 기다렸는데, 복귀전부터 100% 활약을 기대해도 될까요?',
    choices: [
      {
        id: 'a',
        label: '부담 없는 환영 인사',
        toneTag: '따뜻한 보호',
        quote:
          '"돌아온 것만으로도 새 선수 1억 유로 주고 영입한 기분입니다! 무리하게 완벽할 필요 없어요. 경기 감각만 천천히 찾아도 우리 팀엔 엄청난 힘입니다."',
        successEffect: {
          targetMoraleDelta: 2,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 "1억 유로 새 영입" 비유에 {playerName}이(가) 감동하며 환하게 웃습니다.',
        },
      },
      {
        id: 'b',
        label: '재활 노력 극찬',
        toneTag: '노력 인정',
        quote:
          '"{playerName}이(가) 재활실에서 남들 퇴근할 때까지 혼자 땀 흘린 걸 제가 다 봤습니다. 더 단단해져서 돌아왔으니 기대하셔도 좋습니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 고된 재활을 알아준 감독에게 {playerName}이(가) 큰 힘을 얻습니다.',
        },
      },
      {
        id: 'c',
        label: '유쾌한 복귀 환영 드립',
        toneTag: '유쾌한 드립',
        quote:
          '"의무실 침대 주인이 드디어 퇴실했습니다! 의료팀장님이 제일 아쉬워하시더군요. 이제 잔디 위에서 실컷 뛰어놀 시간입니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 유쾌한 복귀 신고식에 {playerName}과(와) 선수단 모두가 웃음바다가 됩니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_07_injury_cover_spotlight',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'player_injury_cover',
    title: '주전 공백 메울 {playerName} 향한 의구심',
    speakerLabel: '사전 기자회견 · 축구 기자',
    prompt:
      '핵심 주전의 부상 이탈로 {playerName} 선수가 중책을 맡게 됐습니다. 팬들 사이에선 "빈자리가 너무 크지 않겠냐"는 걱정이 큰데요?',
    choices: [
      {
        id: 'a',
        label: '절대적 믿음 선언',
        toneTag: '전폭 신뢰',
        quote:
          '"빈자리를 메우는 게 아니라 자기 무대를 여는 겁니다. 훈련장에서 {playerName}의 폼을 본 사람이라면 절대 걱정 안 할 겁니다. 오늘 밤 모두를 놀라게 할 겁니다."',
        successEffect: {
          targetMoraleDelta: 3,
          reactionText:
            '🔥 감독의 100% 지지에 {playerName}의 눈빛이 자신감으로 빛납니다!',
        },
      },
      {
        id: 'b',
        label: '팀 전체 커버 강조로 부담 완화',
        toneTag: '부담 분산',
        quote:
          '"한 명에게 모든 짐을 넘기지 않습니다. {playerName}은(는) 자기 장점만 발휘하면 되고, 나머지는 팀원 10명이 같이 메워줄 겁니다."',
        successEffect: {
          targetMoraleDelta: 2,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 부담이 확 줄어든 {playerName}이(가) 편안한 마음으로 경기를 준비합니다.',
        },
      },
      {
        id: 'c',
        label: '주전 경쟁 선언',
        toneTag: '야망 자극',
        quote:
          '"축구에선 부상 대체로 나와서 월드클래스가 된 전설이 수두룩합니다. {playerName}이(가) 오늘 잘하면 부상자가 돌아와도 긴장해야 할 겁니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 강렬한 동기부여에 {playerName}이(가) 주먹을 불끈 쥡니다!',
        },
      },
    ],
  },
  {
    id: 'pc_plr_08_big_club_interest',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'any',
    title: '타 구단의 {playerName} 영입 관심설',
    speakerLabel: '공식 기자회견 · 이적 전문 기자',
    prompt:
      '유럽 빅클럽들이 {playerName} 선수를 노리고 있다는 보도가 잇따르고 있습니다. 천문학적인 제의가 오면 보내주실 생각인가요?',
    choices: [
      {
        id: 'a',
        label: 'NFS(판매 불가) 단호한 선언',
        toneTag: '핵심 대우',
        quote:
          '"돈 가방 들고 와도 문전박대할 겁니다. {playerName}은(는) 우리 프로젝트의 심장이고, 가격표 자체가 안 붙어 있는 선수입니다."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 "가격표 없는 핵심" 대우에 {playerName}의 충성심과 사기가 크게 상승합니다!',
        },
      },
      {
        id: 'b',
        label: '유쾌한 10억 유로 드립',
        toneTag: '유쾌한 드립',
        quote:
          '"음… 10억 유로에 전용기 한 대 얹어주시면 커피 한 잔 정도는 마셔볼게요. 농담이고, {playerName}은(는) 여기서 트로피 들 생각밖에 없습니다."',
        successEffect: {
          targetMoraleDelta: 2,
          teamMoraleDelta: 1,
          reactionText:
            '🔥 "10억 유로 + 전용기" 드립에 라커룸에서 {playerName}이(가) 동료들에게 놀림받으며 신나합니다.',
        },
      },
      {
        id: 'c',
        label: '관심 자체가 영광이라는 쿨한 대응',
        toneTag: '여유 대응',
        quote:
          '"우리 선수가 탐난다는 건 우리가 잘하고 있다는 뜻이죠. 기분 좋은 뉴스네요. 물론 이적은 어림도 없습니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '📰 여유 넘치는 대응에 {playerName}도 미소를 지으며 경기에 집중합니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_09_workrate_praise',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'any',
    title: '묵묵한 언성 히어로 {playerName} 조명',
    speakerLabel: '공식 기자회견 · 분석 리포터',
    prompt:
      '화려한 스포트라이트 뒤에서 {playerName} 선수의 활동량과 헌신이 대단하다는 데이터가 나왔습니다. 감독님이 보시는 {playerName}의 가치는요?',
    choices: [
      {
        id: 'a',
        label: '"11명 다 저 선수로 채우고 싶다"',
        toneTag: '최고의 찬사',
        quote:
          '"복제 기술이 합법이면 {playerName} 11명으로 베스트 일레븐 짜고 싶습니다. 감독에게 저런 선수가 있다는 건 복권 당첨이나 다름없어요."',
        successEffect: {
          targetMoraleDelta: 3,
          reactionText:
            '🔥 "복제해서 11명 쓰고 싶다"는 찬사에 {playerName}의 얼굴이 귀까지 빨개지며 사기가 폭발합니다!',
        },
      },
      {
        id: 'b',
        label: '모든 감독의 꿈이라 평가',
        toneTag: '품격 칭찬',
        quote:
          '"눈에 띄지 않는 곳에서 팀의 빈틈을 다 메워주는 진짜 프로입니다. 우리 스쿼드의 모범이죠."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 묵묵한 노력을 인정받은 {playerName}이(가) 깊은 보람을 느낍니다.',
        },
      },
      {
        id: 'c',
        label: '칭찬 + 체력 관리 농담',
        toneTag: '유쾌한 배려',
        quote:
          '"진짜 미친 활동량이죠. 가끔 심장이 두 개인가 싶어서 의료팀한테 물어볼 정도입니다. 이제 좀 살살 뛰어도 된다고 전해줘야겠네요."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 "심장이 두 개" 드립에 {playerName}이(가) 환하게 웃으며 활력을 얻습니다.',
        },
      },
    ],
  },
  {
    id: 'pc_plr_10_media_comparison',
    category: 'press_conference',
    targetScope: 'player',
    trigger: 'any',
    title: '전설과의 비교 질문 ({playerName})',
    speakerLabel: '공식 기자회견 · 축구 매거진',
    prompt:
      '최근 {playerName} 선수의 플레이가 과거 전설적인 스타들을 떠올리게 한다는 찬사가 많습니다. 본인은 부담스러워하지 않을까요?',
    choices: [
      {
        id: 'a',
        label: '"제2의 누군가 말고 제1의 {playerName}"',
        toneTag: '명장 어록',
        quote:
          '"제2의 전설 같은 별명은 싫어합니다. {playerName}은(는) 그냥 제1의 {playerName}으로 역사에 남을 선수니까요."',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 멋진 어록에 {playerName}이(가) 자부심을 가득 안고 훈련장으로 나섭니다.',
        },
      },
      {
        id: 'b',
        label: '발 땅에 붙이기 + 칭찬',
        toneTag: '차분한 격려',
        quote:
          '"비교되는 것만으로도 영광이지만, 진짜 전설이 되려면 한 시즌이 아니라 끝까지 꾸준해야죠. {playerName}은(는) 충분히 그릇이 됩니다."',
        successEffect: {
          targetMoraleDelta: 1,
          reactionText:
            '🔥 균형 잡힌 조언에 {playerName}이(가) 침착하게 목표 의식을 다집니다.',
        },
      },
      {
        id: 'c',
        label: '유머 섞인 발롱도르 예약 드립',
        toneTag: '유쾌한 드립',
        quote:
          '"에이, 지금처럼만 하면 나중에 그 전설들이 인터뷰에서 \'{playerName}이랑 비교돼서 영광\'이라고 말할걸요? 자, 그만 띄워주시고 다음 질문!"',
        successEffect: {
          targetMoraleDelta: 2,
          reactionText:
            '🔥 화끈한 농담에 {playerName}이(가) 빵 터지며 기분이 최고조로 올라갑니다.',
        },
      },
    ],
  },
];
