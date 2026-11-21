import type { ManagerEventTemplate } from '../types/condition';

/**
 * 36 Locker Room Talk Events:
 * - 10 Team-wide
 * - 12 Position-group targeted (4 FW, 4 MF, 4 DF_GK)
 * - 14 Individual player targeted (encouragement, Ferguson hairdryer criticism, 1:1 talks)
 * Every event includes real risk/trade-off choices where harsh or mistimed answers can lower morale.
 */
export const LOCKER_ROOM_EVENTS: ManagerEventTemplate[] = [
  {
    "id": "lr_team_01_lose_streak_rally",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "lose_streak",
    "title": "연패 침체기 탈출 라커룸 연설",
    "speakerLabel": "라커룸 전체 연설 · {opponentName}전 직전",
    "prompt": "최근 {streak}연패로 라커룸 공기가 얼어붙었습니다. 선수들은 축구화 끈만 만지작거리며 아무도 눈을 마주치지 못합니다.",
    "choices": [
      {
        "id": "a",
        "label": "클롭식 헤비메탈 열정 폭발",
        "toneTag": "열정 폭발",
        "quote": "\"다들 고개 들어! 지금 표정이 무슨 강등 확정된 팀 같잖아. 두 번 졌다고 우리가 누구인지 잊었어? 오늘 {opponentName}전은 예쁜 축구 필요 없어. 1분부터 90분까지 미친 듯이 뛰어다니는 헤비메탈 축구를 보여주자고! 할 수 있지?!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 라커룸 천장이 들썩일 정도의 함성이 터져 나옵니다! 침체됐던 눈빛에 다시 불이 붙었습니다.",
          "frozenReliefBonus": 1
        }
      },
      {
        "id": "b",
        "label": "냉정한 책임 공유 & 부담 제거",
        "toneTag": "멘탈 해동",
        "quote": "\"최근 연패는 내 전술 선택 미스도 컸다. 언론이 뭐라 떠들든 욕은 내가 다 먹어줄 테니, 너희는 오늘 경기장에서 '실수하면 어쩌지'라는 생각만 머릿속에서 지워. 평소 훈련하던 대로만 하자.\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "frozenReliefBonus": 2,
          "reactionText": "🔥 \"욕은 내가 먹는다\"는 한마디에 유독 위축돼 있던 선수들의 어깨에서 무거운 짐이 내려앉습니다."
        }
      },
      {
        "id": "c",
        "label": "충격 요법 (전원 경쟁 예고)",
        "toneTag": "서늘한 경고",
        "riskLabel": "하이리스크 (55%)",
        "successChance": 0.55,
        "quote": "\"솔직히 말할게. 최근 경기력은 이 유니폼 무게에 안 어울렸어. 오늘도 어슬렁거리는 사람은 이름값 상관없이 다음 경기 벤치 직행이다. 증명해.\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 서늘한 경고에 베테랑 선수들이 먼저 자리에서 일어나 \"오늘 무조건 이긴다\"며 분위기를 다잡습니다!"
        },
        "failEffect": {
          "teamMoraleDelta": -1,
          "reactionText": "❄️ 가뜩이나 무거운 분위기가 더 얼어붙으며 선수들 사이에 어색한 침묵이 흐릅니다."
        }
      }
    ]
  },
  {
    "id": "lr_team_02_big_match_hype",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "big_match",
    "title": "빅매치 터널 입장 직전 최후의 한마디",
    "speakerLabel": "경기 직전 라커룸 · {opponentName}전",
    "prompt": "터널 너머로 {opponentName}전 관중들의 함성이 벽을 울립니다. 선수들의 심장 박동이 느껴질 만큼 팽팽한 긴장감이 흐릅니다.",
    "choices": [
      {
        "id": "a",
        "label": "전사들의 밤 선포",
        "toneTag": "심장 불태우기",
        "quote": "\"저 밖에서 들리는 소리 들려? 오늘 밤은 평범한 하루가 아니야. 10년 뒤에 은퇴하고 맥주 마실 때 '그날 {opponentName}전 기억나지?' 하고 떠들 경기를 오늘 만드는 거야. 나가서 찢어놓고 와!\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 주장 선수가 먼저 소리치며 터널로 뛰어나갑니다! 팀 전체의 투지가 임계점을 넘었습니다."
        },
        "riskLabel": "도박 (65%)",
        "successChance": 0.65,
        "failEffect": {
          "teamMoraleDelta": -1,
          "reactionText": "❄️ 너무 비장한 연설에 오히려 과긴장한 어린 선수들의 다리가 살짝 굳어 버립니다."
        }
      },
      {
        "id": "b",
        "label": "냉철한 전술 요약 & 평정심",
        "toneTag": "차가운 머리",
        "quote": "\"심장은 뜨겁게, 머리는 얼음처럼 차갑게. 첫 10분만 상대 압박을 침착하게 풀어내면 경기는 우리 손바닥 안에 들어온다. 서로 소리 질러주면서 간격만 지켜!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "secondaryGroup": "MF",
          "secondaryGroupDelta": 1,
          "reactionText": "🔥 침착한 지시에 선수들이 숨을 고르며 단단한 눈빛을 교환합니다."
        }
      },
      {
        "id": "c",
        "label": "안첼로티식 긴장 완화 농담",
        "toneTag": "여유 미소",
        "quote": "\"야, 다들 왜 그렇게 굳어 있어? 치과 대기실이야? 상대도 똑같이 두 다리 달린 인간이야. 걔네가 우리보다 지금 더 떨고 있을걸? 웃으면서 한 판 놀다 오자!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "frozenReliefBonus": 1,
          "reactionText": "🔥 \"치과 대기실\" 드립에 라커룸에 웃음이 번지며 경직됐던 근육이 사르르 풀립니다."
        }
      }
    ]
  },
  {
    "id": "lr_team_03_cup_ucl_knockout",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "cup_or_ucl",
    "title": "단두대 매치! 토너먼트 라커룸 연설",
    "speakerLabel": "토너먼트 라커룸 · {opponentName}전",
    "prompt": "지면 끝나는 토너먼트 무대입니다. 라커룸에 걸린 유니폼들이 유독 비장해 보입니다. 선수들이 감독님의 입을 바라봅니다.",
    "choices": [
      {
        "id": "a",
        "label": "후회 없는 90분 호소",
        "toneTag": "투혼 연설",
        "quote": "\"토너먼트엔 '다음에 잘하자'가 없어. 종료 휘슬 울렸을 때 다리에 쥐가 나서 못 걸을 만큼 다 쏟아붓고 나오자. 이기고 나서 라커룸 문짝 부서지게 파티할 준비됐지?!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 선수들이 서로 어깨를 부딪히며 \"가자!!\"를 외칩니다. 압도적인 결속력입니다!"
        }
      },
      {
        "id": "b",
        "label": "무리뉴식 \"결승전은 즐기는 게 아니라 이기는 것\"",
        "toneTag": "승부사 기질",
        "quote": "\"토너먼트는 예쁘게 뛰러 나가는 자리가 아니야. 이기러 나가는 자리지. 1-0이든 승부차기든 상관없어. 어떤 방식으로든 살아남아서 다음 라운드 티켓 뜯어와!\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 날카로운 승부사 기질이 선수단 전체에 전염됩니다!"
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "teamMoraleDelta": -1,
          "reactionText": "❄️ \"무조건 살아남으라\"는 압박이 토너먼트 공포를 자극해 라커룸 공기가 무거워집니다."
        }
      },
      {
        "id": "c",
        "label": "벤치 조커들까지 챙기는 총력전 선언",
        "toneTag": "16인 총력전",
        "quote": "\"오늘 선발 11명이 전반을 흔들고, 벤치 5명이 후반에 끝장을 낼 거야. 연장전까지 가도 우리가 이긴다. 16명 전원이 오늘 경기의 주인공이다!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "benchMoraleDelta": 2,
          "reactionText": "🔥 벤치 선수들까지 눈이 번쩍 뜨이며 누구든 투입되면 뒤집을 기세로 몸을 풉니다!"
        }
      }
    ]
  },
  {
    "id": "lr_team_04_win_streak_complacency",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "win_streak",
    "title": "연승 속 방심 주의보",
    "speakerLabel": "라커룸 전체 미팅 · {streak}연승 중",
    "prompt": "{streak}연승 행진 덕분에 훈련장 분위기가 최고지만, 일각에서는 살짝 들뜬 기운도 감지됩니다. 다음 상대 {opponentName}전 전 어떤 톤을 잡을까요?",
    "choices": [
      {
        "id": "a",
        "label": "기세 그대로 밀어붙이기",
        "toneTag": "기세 유지",
        "quote": "\"지금 우리 팀 기세면 누가 와도 못 막아! 이 리듬 끊기지 않게 오늘도 초반 20분 안에 경기 끝내버리자. {streak}연승? 아직 시작도 안 했어!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 자신감이 폭발한 선수들이 가벼운 발걸음으로 피치를 향해 나섭니다!"
        }
      },
      {
        "id": "b",
        "label": "퍼거슨식 \"0점부터 다시 시작\"",
        "toneTag": "방심 차단",
        "quote": "\"어제 이긴 거로 오늘 골 넣어주지 않아. 약팀한테 한 번 방심해서 미끄러지면 그동안 쌓은 연승 다 물거품이야. 오늘도 꼴찌랑 붙는 게 아니라 결승전처럼 뛰어!\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 자칫 풀릴 뻔했던 나사가 다시 팽팽하게 조여집니다."
        },
        "riskLabel": "역효과 주의 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "teamMoraleDelta": -1,
          "reactionText": "❄️ 연승 중 차가운 군기 잡기에 라커룸의 들뜬 리듬이 갑자기 뚝 끊겨 버립니다."
        }
      },
      {
        "id": "c",
        "label": "유쾌한 피자·휴가 보너스 공약",
        "toneTag": "당근 작전",
        "quote": "\"오늘도 깔끔하게 이기면 내일 오전 훈련 취소하고 내가 전 선수단 저녁 쏜다. 단, 한 골이라도 어이없게 먹히면 셔틀런 10바퀴다. 알아서 해!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 \"오전 훈련 취소!\" 한마디에 라커룸에서 환호성이 터져 나옵니다!"
        }
      }
    ]
  },
  {
    "id": "lr_team_05_heavy_loss_recovery",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "heavy_loss",
    "title": "참패 직후 침묵의 라커룸",
    "speakerLabel": "경기 종료 직후 · 라커룸",
    "prompt": "뼈아픈 대패 직후, 라커룸에는 물병 떨어지는 소리조차 크게 들릴 만큼 무거운 침묵이 깔려 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "퍼거슨식 풀파워 라커룸 폭발",
        "toneTag": "헤어드라이어",
        "riskLabel": "하이리스크 (55%)",
        "successChance": 0.55,
        "quote": "(전술 보드를 쾅 치며) \"이게 축구야?! 상대가 패스할 때 구경만 할 거면 관중석 표 사서 앉아 있지 왜 유니폼 입었어! 오늘 밤 잠 오나 보자. 다음 경기에서 피 토하고 갚아!\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "frozenReliefBonus": 1,
          "reactionText": "🔥 서릿발 같은 호통에 선수들의 눈빛이 번쩍 뜨이며 독기가 차오릅니다! 다음 경기 반격이 기대됩니다."
        },
        "failEffect": {
          "teamMoraleDelta": -2,
          "reactionText": "❄️ 지나치게 거센 분노에 선수들이 잔뜩 주눅 들어 서로 눈치만 봅니다."
        }
      },
      {
        "id": "b",
        "label": "차분한 \"오늘 밤만 아파하자\"",
        "toneTag": "멘탈 케어",
        "quote": "\"오늘 진짜 끔찍했다, 인정해. 근데 고개 숙이고 있다고 스코어보드 안 바뀌어. 오늘 밤까지만 실컷 분해하고, 내일 아침엔 이 경기 기억에서 지워. 복수는 다음 라운드에서 하는 거야.\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "frozenReliefBonus": 2,
          "reactionText": "🔥 침착한 위로에 무너졌던 선수들의 멘탈이 빠르게 복구됩니다."
        }
      },
      {
        "id": "c",
        "label": "짧고 묵직한 침묵의 한마디",
        "toneTag": "카리스마",
        "quote": "\"오늘은 잔소리 안 한다. 너희가 제일 잘 알 테니까. 다만 이 굴욕적인 기분, 잊지 말고 가슴에 새겨둬. 다음 경기 경기장에서 대답해.\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 오히려 화내지 않는 감독의 묵직한 한마디에 선수들이 스스로 마음을 다잡습니다."
        }
      }
    ]
  },
  {
    "id": "lr_team_06_title_race_final_push",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "title_race",
    "title": "우승 레이스 분수령 라커룸",
    "speakerLabel": "라커룸 전체 연설 · 현재 {rank}위",
    "prompt": "우승 경쟁이 한 치 앞도 안 보이는 살얼음판입니다. {opponentName}전을 이기면 우승의 7부 능선을 넘습니다.",
    "choices": [
      {
        "id": "a",
        "label": "역사의 주인공이 될 시간",
        "toneTag": "명연설",
        "quote": "\"주변을 둘러봐. 옆에 앉은 친구들이랑 올 시즌 트로피 들고 퍼레이드하는 그림 그려지지 않아? 그 버스 올라타려면 오늘 {opponentName}부터 넘어야 해. 다 같이 역사를 쓰자!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 트로피 퍼레이드 이야기에 라커룸 전체가 소름 돋는 전율로 가득 찹니다!"
        }
      },
      {
        "id": "b",
        "label": "한 경기씩만 보자는 실리 주문",
        "toneTag": "평정심",
        "quote": "\"우승 계산기 두드리는 순간 발이 꼬인다. 순위표 생각하지 마. 그냥 오늘 90분, 공 하나 더 따내고 패스 한 번 더 정확하게 주는 것만 생각하자.\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 선수들이 과도한 흥분을 가라앉히고 날카로운 집중 모드로 전환합니다."
        }
      },
      {
        "id": "c",
        "label": "경쟁팀을 향한 유쾌한 한 방",
        "toneTag": "자신감",
        "quote": "\"지금 경쟁팀 라커룸에선 우리가 미끄러지기만 기도하고 있을 거야. 미안하지만 걔네 기도 안 들어주자고! 오늘 확실히 쐐기 박아버리자!\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 선수들이 씩 웃으며 \"기도발 안 통하게 만들어주죠!\"라고 호응합니다."
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "teamMoraleDelta": -1,
          "reactionText": "❄️ 경쟁팀을 의식한 발언이 오히려 우승 압박감을 떠올리게 만들며 선수들이 굳어집니다."
        }
      }
    ]
  },
  {
    "id": "lr_team_07_fatigue_encouragement",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "fatigue_overload",
    "title": "지옥의 연전 속 지친 라커룸",
    "speakerLabel": "라커룸 전체 미팅 · 빡빡한 일정",
    "prompt": "연이은 강행군에 라커룸 곳곳에서 파스 냄새와 깊은 한숨 소리가 들립니다. 선수들의 다리가 천근만근 무거워 보입니다.",
    "choices": [
      {
        "id": "a",
        "label": "고생 인정 + 정신력 독려",
        "toneTag": "따뜻한 공감",
        "quote": "\"다들 다리 묵직한 거 내 눈에도 다 보여. 진짜 고생 많다. 근데 상대 팀도 똑같이 힘들어. 다리가 안 움직일 때 한 발 더 내딛는 팀이 결국 이기는 거야. 오늘만 조금 더 버텨주자!\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 진심 어린 공감에 지쳐 있던 선수들이 서로 어깨를 주물러 주며 다시 일어섭니다."
        },
        "riskLabel": "역효과 주의 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "teamMoraleDelta": -1,
          "reactionText": "❄️ \"정신력으로 버텨라\"는 말에 이미 방전 직전인 주전 선수들의 눈빛이 살짝 흐려집니다."
        }
      },
      {
        "id": "b",
        "label": "벤치 멤버 전원 출전 준비 명령",
        "toneTag": "로테이션 신뢰",
        "quote": "\"혼자 90분 다 뛰려고 아끼지 마! 힘들면 60분만 미친 듯이 쏟고 손 들어. 뒤에 벤치에 싱싱한 녀석들이 칼 갈고 기다리고 있으니까. 오늘은 16명이 나눠 뛰는 날이다!\"",
        "successEffect": {
          "starterMoraleDelta": 0,
          "benchMoraleDelta": 2,
          "reactionText": "🔥 선발은 부담을 덜고, 벤치 선수들은 출전 기대감에 눈이 반짝입니다!"
        }
      },
      {
        "id": "c",
        "label": "마사지 & 회식 풀패키지 공약",
        "toneTag": "유쾌한 보상",
        "quote": "\"오늘 경기 끝나면 의무실 마사지 베드 풀가동하고 회복 식단 특식으로 깐다! 얼른 {opponentName} 잡고 편하게 쉬자고!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 유쾌한 보상 약속에 파스 냄새 가득하던 라커룸에 웃음꽃이 핍니다."
        }
      }
    ]
  },
  {
    "id": "lr_team_08_comeback_celebration",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "comeback_win",
    "title": "기적 같은 역전승 직후 라커룸 광란",
    "speakerLabel": "경기 종료 직후 · 라커룸",
    "prompt": "극적인 역전승을 거두고 라커룸에 들어오자 물병이 날아다니고 스피커에서 음악이 터져 나옵니다!",
    "choices": [
      {
        "id": "a",
        "label": "함께 춤추는 클롭식 세리머니",
        "toneTag": "광란의 축제",
        "quote": "\"야, 볼륨 더 올려!! 오늘 너희 진짜 미쳤어! 지고 있을 때도 아무도 고개 안 숙이는 거 보고 난 이길 줄 알았다! 오늘 밤은 마음껏 즐겨!\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 감독까지 합류한 광란의 세리머니! 라커룸 케미스트리가 최고조에 달합니다!"
        }
      },
      {
        "id": "b",
        "label": "교체 투입 선수들 특별 치하",
        "toneTag": "벤치 예우",
        "quote": "\"오늘 경기를 뒤집은 건 후반에 들어가서 판을 바꾼 벤치 멤버들이야! 다 같이 박수 쳐줘! 이게 바로 진짜 원팀이다!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "benchMoraleDelta": 2,
          "reactionText": "🔥 벤치 선수들이 동료들의 기립 박수를 받으며 감격합니다!"
        }
      },
      {
        "id": "c",
        "label": "유쾌한 심장병 경고 드립",
        "toneTag": "유쾌한 드립",
        "quote": "\"야, 이겨서 너무 좋은데 나 심장마비로 실려 가게 만들 셈이야?! 다음엔 제발 전반전에 3-0 만들어 놓고 편하게 가자! 다들 최고였어!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 라커룸 전체가 폭소하며 최고의 승리의 밤을 만끽합니다."
        },
        "riskLabel": "역효과 주의 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "secondaryGroup": "DF_GK",
          "secondaryGroupDelta": -1,
          "reactionText": "❄️ 심장병 드립에 선제 실점을 허용했던 수비수들이 괜히 뜨끔해하며 고개를 숙입니다."
        }
      }
    ]
  },
  {
    "id": "lr_team_09_midseason_team_dinner",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "any",
    "title": "라커룸 팀워크 결속 미팅",
    "speakerLabel": "주중 라커룸 · 전체 미팅",
    "prompt": "긴 시즌을 치르다 보니 주전과 벤치, 베테랑과 젊은 선수들 사이에 약간의 피로와 소소한 거리감이 느껴집니다.",
    "choices": [
      {
        "id": "a",
        "label": "바비큐 파티 & 자유 토크 제안",
        "toneTag": "화합 이벤트",
        "quote": "\"오늘은 전술 영상 끄자! 다 같이 훈련장 잔디에서 바비큐 구워 먹으면서 그동안 감독한테 서운했던 거 다 털어놔. 단, 내 머리 스타일 놀리는 건 금지다.\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 예상치 못한 바비큐 파티에 선수단 전체가 어우러져 웃고 떠들며 분위기가 살아납니다!"
        }
      },
      {
        "id": "b",
        "label": "미니 풋살 토너먼트(패자 커피 쏘기)",
        "toneTag": "유쾌한 경쟁",
        "quote": "\"오늘 훈련 마지막 30분은 포지션 섞어서 5대5 미니 게임이다! 진 팀은 내일 전원 스무디 쏘기! 골키퍼도 공격수로 뛰어봐!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "benchMoraleDelta": 1,
          "reactionText": "🔥 골키퍼가 바이시클 킥을 시도하다 넘어지며 훈련장이 웃음바다가 됐습니다!"
        }
      },
      {
        "id": "c",
        "label": "시즌 목표 재확인 브리핑",
        "toneTag": "동기부여",
        "quote": "\"우리가 시즌 첫날 라커룸 벽에 적어놨던 목표 기억나지? 지금 다들 너무 잘해주고 있어. 조금만 더 뭉치면 그 꿈이 현실이 된다.\"",
        "successEffect": {
          "teamMoraleDelta": 2,
          "reactionText": "🔥 초심을 되새긴 선수들이 진지한 표정으로 고개를 끄덕입니다."
        },
        "riskLabel": "역효과 주의 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "teamMoraleDelta": -1,
          "reactionText": "❄️ 회식 분위기인 줄 알았는데 딱딱한 목표 브리핑이 이어지자 선수들이 슬며시 시계를 봅니다."
        }
      }
    ]
  },
  {
    "id": "lr_team_10_underdog_trap_warning",
    "category": "locker_room",
    "targetScope": "team",
    "trigger": "any",
    "title": "하위권 팀 원정 방심 경고",
    "speakerLabel": "경기 직전 라커룸 · {opponentName}전",
    "prompt": "객관적 전력에서 앞서는 {opponentName}전을 앞두고 라커룸이 조금 느슨해 보입니다. 방심하면 일격을 맞을 수 있는 경기입니다.",
    "choices": [
      {
        "id": "a",
        "label": "강팀의 품격 강조",
        "toneTag": "프로 의식",
        "quote": "\"상대가 누구든 존중하는 제일 좋은 방법은 90분 동안 100% 전력으로 박살 내는 거야. 대충 뛰다 비기면 일주일 내내 이불킥한다. 깔끔하게 끝내자!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "secondaryGroup": "FW",
          "secondaryGroupDelta": 1,
          "reactionText": "🔥 \"일주일 이불킥 방지\" 한마디에 공격진과 선수단이 정신을 바짝 차립니다."
        }
      },
      {
        "id": "b",
        "label": "초반 15분 집중 압박 지시",
        "toneTag": "전술 집중",
        "quote": "\"전반 15분 안에 선제골 못 넣으면 상대가 10명 다 내려앉아서 지옥이 열린다. 휘슬 울리자마자 숨도 못 쉬게 몰아붙여!\"",
        "successEffect": {
          "teamMoraleDelta": 1,
          "reactionText": "🔥 명확한 경기 플랜에 선수들이 빠르게 전투 모드로 돌입합니다."
        }
      },
      {
        "id": "c",
        "label": "무실점 승리 보너스 걸기",
        "toneTag": "수비 동기부여",
        "quote": "\"이기는 건 기본이고, 오늘 무실점으로 끝내면 수비진하고 골키퍼한테 특급 커피 쿠폰 쏜다! 물론 공격수들도 같이 내려와서 도와줘!\"",
        "successEffect": {
          "secondaryGroup": "DF_GK",
          "secondaryGroupDelta": 2,
          "reactionText": "🔥 수비수들이 \"오늘 슈팅 한 개도 안 준다!\"며 의욕을 불태웁니다."
        },
        "riskLabel": "도박 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "secondaryGroup": "FW",
          "secondaryGroupDelta": -1,
          "reactionText": "❄️ \"수비진만 보너스 챙겨주시나요?\" 공격수들이 장난 반 진담 반으로 입이 삐죽 나옵니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_01_fw_xg_drought",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "FW",
    "trigger": "xg_underperform",
    "title": "높은 xG에도 골 가뭄에 빠진 공격진",
    "speakerLabel": "라커룸 포지션 미팅 · 공격진 (FW)",
    "prompt": "경기 후 공격수들이 전광판의 슈팅 대비 득점 통계를 보며 한숨을 쉬고 있습니다. 골대가 유독 작아 보였던 하루였습니다.",
    "choices": [
      {
        "id": "a",
        "label": "쿨한 골잡이 심리 케어 (케첩병 이론)",
        "toneTag": "심리 케어",
        "quote": "\"야, 골은 케첩병이랑 똑같아. 안 나올 땐 미친 듯이 두드려도 안 나오다가 한 번 터지면 콸콸 쏟아지거든. 찬스를 못 만든 게 아니잖아? 다음 경기엔 상대 골키퍼가 울면서 퇴근하게 만들어.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 \"케첩병 이론\"에 공격수들이 피식 웃으며 고개를 끄덕입니다. 결정력에 대한 강박이 한결 풀렸습니다."
        }
      },
      {
        "id": "b",
        "label": "전술 보드 컷백 디테일 교정",
        "toneTag": "전술 교정",
        "quote": "\"박스 안에서 마지막 터치가 반 박자 빨랐어. 상대 수비 라인이 내려앉을 땐 무리한 슈팅보다 컷백 타이밍을 한 템포만 더 잡아. 내일 오전엔 마무리 패턴만 30분 집중하자.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "secondaryGroup": "MF",
          "secondaryGroupDelta": 1,
          "reactionText": "🔥 공격진과 미드필더진이 전술 보드 앞에 모여 컷백 타이밍을 직접 맞추며 의욕을 다집니다."
        }
      },
      {
        "id": "c",
        "label": "따끔한 결정력 질책",
        "toneTag": "하이리스크 질책",
        "riskLabel": "하이리스크 (60%)",
        "successChance": 0.6,
        "quote": "\"미드필더랑 수비수들이 목숨 걸고 공 뺏어다 밥상 차려줬는데 숟가락을 엎으면 어떡해. 다음 경기엔 찬스 오면 눈 딱 감고 골망 찢어놓을 각오로 때려.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 자존심이 상한 공격수들이 \"다음 경기 멀티골 박고 말겠다\"며 이를 악뭅니다!"
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "secondaryGroup": "DF_GK",
          "secondaryGroupDelta": 1,
          "reactionText": "❄️ 공격수들의 표정이 굳어지며 박스 안에서의 부담감이 오히려 커졌습니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_02_fw_selfish_play",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "FW",
    "trigger": "any",
    "title": "공격진 슈팅 욕심 vs 이타적 연계",
    "speakerLabel": "라커룸 포지션 미팅 · 공격진 (FW)",
    "prompt": "최근 경기에서 공격수들이 동료가 더 좋은 위치에 있는데도 무리하게 직접 슈팅을 시도하는 장면이 몇 차례 나왔습니다.",
    "choices": [
      {
        "id": "a",
        "label": "어시스트도 골만큼 멋지다 강조",
        "toneTag": "팀플레이 유도",
        "quote": "\"킬패스 하나 찔러서 동료 빈 골대 골 넣게 해주는 게 원더골보다 멋질 때가 많아. 너희끼리 눈빛만 맞아도 상대 수비수들 멘탈 나간다. 서로 도와줘!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 공격수들이 서로 웃으며 \"다음엔 내가 완벽하게 깔아줄게!\"라고 약속합니다."
        }
      },
      {
        "id": "b",
        "label": "공격수의 야성(탐욕) 인정",
        "toneTag": "킬러 본능 존중",
        "quote": "\"공격수가 골 욕심 없는 게 더 문제지! 각도 나오면 과감하게 때려. 대신 진짜 노마크 동료 보이면 그때만 쓱 밀어줘. 자신감 있게 때려!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 슈팅 본능을 존중해 주자 공격수들의 얼굴에 화색이 돕니다."
        }
      },
      {
        "id": "c",
        "label": "이기적 플레이 경고",
        "toneTag": "강력 주의",
        "riskLabel": "하이리스크 (55%)",
        "successChance": 0.55,
        "quote": "\"개인 득점왕 노리다 팀 승점 날리면 절대 안 봐준다. 노마크 동료 안 주고 날려 먹으면 바로 교체 아웃이다!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 단호한 원칙 제시에 공격수들이 고개를 끄덕이며 연계 플레이를 다짐합니다."
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 공격수들이 슈팅 타이밍을 주저하게 될 만큼 살짝 눈치를 보기 시작합니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_03_fw_counter_plan",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "FW",
    "trigger": "big_match",
    "title": "{opponentName} 뒷공간 공략 공격진 브리핑",
    "speakerLabel": "경기 전 전술 미팅 · 공격진 (FW)",
    "prompt": "강팀 {opponentName}이(가) 수비 라인을 높게 올릴 것으로 예상됩니다. 공격수들에게 마지막 지시를 내릴 타이밍입니다.",
    "choices": [
      {
        "id": "a",
        "label": "뒷공간 스프린트 프리롤 부여",
        "toneTag": "공격 자유도",
        "quote": "\"오늘 상대 센터백 뒤가 고속도로처럼 뚫릴 거야. 오프사이드 라인 아슬아슬하게 타다가 패스 뜨는 순간 미친 듯이 침투해! 오늘은 너희가 마음껏 요리하는 날이야.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 프리롤과 뒷공간 공략 지시에 공격수들이 신이 나서 주먹을 맞댑니다!"
        }
      },
      {
        "id": "b",
        "label": "전방 압박 사냥개 모드 요청",
        "toneTag": "게겐프레싱",
        "quote": "\"공격만 잘하면 반쪽짜리야. 오늘 상대 골키퍼랑 센터백이 공 잡을 때마다 사냥개처럼 달려들어! 거기서 공 하나만 뺏으면 그대로 골이야.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "secondaryGroup": "MF",
          "secondaryGroupDelta": 1,
          "reactionText": "🔥 공격진과 중원의 압박 호흡이 딱 맞아떨어지며 사기가 올라갑니다."
        }
      },
      {
        "id": "c",
        "label": "원샷 원킬 침착성 주문",
        "toneTag": "킬러 멘탈",
        "quote": "\"강팀전에선 찬스가 열 번 안 와. 딱 두 번 올 거야. 그 두 번을 얼음처럼 차갑게 꽂아 넣으면 우리가 영웅이 된다.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 냉정한 킬러 멘탈 주문에 공격수들의 눈빛이 날카로워집니다."
        },
        "riskLabel": "역효과 주의 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ \"원샷 원킬\" 주문이 오히려 \"한 번 놓치면 끝\"이라는 부담으로 작용해 공격진 표정이 굳습니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_04_fw_finishing_party",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "FW",
    "trigger": "big_win",
    "title": "득점 폭격! 공격진 특별 포상",
    "speakerLabel": "경기 후 라커룸 · 공격진 (FW)",
    "prompt": "오늘 공격진이 상대 수비진을 문자 그대로 초토화시켰습니다! 공격수들이 서로 골 세리머니를 흉내 내며 신이 났습니다.",
    "choices": [
      {
        "id": "a",
        "label": "화끈한 화력 극찬",
        "toneTag": "극찬 세례",
        "quote": "\"오늘 너희 움직임은 무슨 게임 치트키 쓴 줄 알았어! 상대 수비수들 오늘 밤 악몽 꾸겠더라. 지금 감각 그대로 다음 경기도 씹어먹자!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 치트키 비유에 공격수들이 환호하며 득점 감각에 대한 확신이 최고조에 달합니다!"
        }
      },
      {
        "id": "b",
        "label": "다음 경기 멀티골 내기",
        "toneTag": "유쾌한 자극",
        "quote": "\"오늘 잘했으니까 다음 경기에서도 합작 3골 이상 넣으면 내가 원하는 메뉴로 회식 쏜다! 대신 한 골도 못 넣으면 전원 스트레칭 30분 추가다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 공격수들이 벌써 메뉴를 고르며 다음 경기 골 사냥을 다짐합니다!"
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 멀티골 내기 제안에 서로 패스 안 하고 욕심낼까 봐 공격진 사이에 미묘한 신경전이 돕니다."
        }
      },
      {
        "id": "c",
        "label": "미드필더들에게 감사를 전하라는 조언",
        "toneTag": "겸손과 화합",
        "quote": "\"골 넣은 건 너무 멋졌는데, 이따가 밥 먹을 때 공 배달해 준 미드필더들한테 음료수 하나씩 돌리는 센스 발휘해라. 그래야 패스가 더 잘 와!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "secondaryGroup": "MF",
          "secondaryGroupDelta": 2,
          "reactionText": "🔥 공격수들이 바로 미드필더들에게 달려가 하이파이브하며 라커룸이 훈훈해집니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_05_mf_possession_war",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "MF",
    "trigger": "big_match",
    "title": "강팀 점유율 전쟁 앞둔 중원 전술 연설",
    "speakerLabel": "라커룸 포지션 미팅 · 미드필더진 (MF)",
    "prompt": "{opponentName}의 강력한 중원 라인과 정면 승부가 예정돼 있습니다. 미드필더들이 전술 보드 주위에 모여 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "펩식 \"삼각형과 템포\" 마스터클래스",
        "toneTag": "전술 몰입",
        "quote": "\"오늘 경기 승패는 너희 발끝에 달렸어. 공 잡기 전에 이미 두 번 고개 돌려. 삼각형만 유지하면 상대가 아무리 뛰어다녀도 공 그림자도 못 밟아. 중원을 완전히 지배해!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 디테일한 전술 신뢰에 미드필더진이 전술 보드를 보며 눈을 반짝입니다!"
        }
      },
      {
        "id": "b",
        "label": "엔진룸 자부심 자극",
        "toneTag": "자존심 불태우기",
        "quote": "\"언론에선 {opponentName} 중원이 리그 최고라던데, 기분 안 나빠? 오늘 90분 동안 누가 진짜 마에스트로인지 똑똑히 수업해 주고 와!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 승부욕에 불이 붙은 미드필더들이 \"오늘 중원 씹어먹고 오겠습니다\"라며 일어섭니다!"
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 자존심을 너무 강하게 긁어 놓은 탓에 중원 선수들이 과열된 기싸움에 부담을 느낍니다."
        }
      },
      {
        "id": "c",
        "label": "실수 두려워 말라는 심리 해방",
        "toneTag": "창의성 해방",
        "quote": "\"압박 세다고 뒤로만 돌리지 마. 킬패스 시도하다 끊겨도 내가 절대 뭐라고 안 해. 너희가 과감하게 찔러줘야 경기가 풀린다. 자신 있게 차!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 과감한 전진 패스 허락에 중원 플레이메이커들이 환하게 미소 짓습니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_06_mf_transition_warning",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "MF",
    "trigger": "conceded_many",
    "title": "역습 허용! 중원 수비 전환 점검",
    "speakerLabel": "라커룸 포지션 미팅 · 미드필더진 (MF)",
    "prompt": "직전 경기에서 공을 뺏긴 뒤 중원 복귀가 늦어져 수비진이 상대 역습에 그대로 노출됐습니다.",
    "choices": [
      {
        "id": "a",
        "label": "5초 재압박 원칙 재정립",
        "toneTag": "전술 피드백",
        "quote": "\"공 뺏기고 3초 동안 멍하니 서 있으면 수비수들은 지옥에 떨어져. 뺏긴 자리에서 딱 5초만 미친 듯이 달라붙어줘. 그것만 되면 실점이 반으로 줄어든다.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "secondaryGroup": "DF_GK",
          "secondaryGroupDelta": 1,
          "reactionText": "🔥 명확한 5초 압박 기준에 미드필더진과 수비진이 서로 고개를 끄덕이며 호흡을 맞춥니다."
        }
      },
      {
        "id": "b",
        "label": "미드필더진 활동량 노고 위로",
        "toneTag": "따뜻한 격려",
        "quote": "\"공격도 돕고 수비도 막느라 제일 힘든 포지션인 거 알아. 오늘 조금 놓친 건 체력 탓도 있어. 간격만 5미터 더 좁히면 훨씬 덜 뛰고도 막을 수 있어!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 고충을 이해해 준 감독에게 미드필더진이 고마워하며 집중력을 회복합니다."
        }
      },
      {
        "id": "c",
        "label": "수비 가담 태만 강력 질책",
        "toneTag": "헤어드라이어",
        "riskLabel": "하이리스크 (55%)",
        "successChance": 0.55,
        "quote": "\"공격할 때만 전력 질주하고 수비할 땐 조깅할 거면 미드필더 자격 없어! 수비수들 죽어라 뛰는데 뒤에서 구경하지 마!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "secondaryGroup": "DF_GK",
          "secondaryGroupDelta": 1,
          "reactionText": "🔥 뼈 때리는 호통에 미드필더진이 반성하며 다음 경기 미친 활동량을 다짐합니다!"
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 거친 질책에 미드필더들이 억울함과 피로감을 느끼며 분위기가 가라앉습니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_07_mf_tempo_control",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "MF",
    "trigger": "any",
    "title": "경기 템포 조율사 미드필더 미팅",
    "speakerLabel": "라커룸 포지션 미팅 · 미드필더진 (MF)",
    "prompt": "훈련 후 미드필더진이 모여 경기 후반 리드 상황에서의 템포 조절을 논의하고 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "\"너희가 경기장의 지휘자다\"",
        "toneTag": "리더십 위임",
        "quote": "\"벤치에서 내가 아무리 소리 질러도 경기장 소음 때문에 안 들려. 피치 위의 감독은 바로 너희야. 늦출 때 늦추고 올릴 때 올리는 판단, 100% 너희한테 맡긴다!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 \"피치 위의 감독\"이라는 신뢰에 미드필더진의 책임감과 사기가 크게 오릅니다!"
        }
      },
      {
        "id": "b",
        "label": "볼 돌리기 론도 훈련 유쾌 제안",
        "toneTag": "즐거운 훈련",
        "quote": "\"템포 감각 올리는 데 론도만 한 게 없지! 오늘 나도 가운데 술래로 들어갈 테니까 20패스 연속 돌리면 내가 음료수 쏜다!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 감독이 술래로 뛰어다니며 땀을 뻘뻘 흘리자 미드필더진이 폭소하며 최고의 호흡을 맞춥니다!"
        }
      },
      {
        "id": "c",
        "label": "중거리 슈팅 옵션 적극 장려",
        "toneTag": "공격 옵션 확대",
        "quote": "\"패스만 찾지 말고 박스 앞에서 공간 열리면 대포알처럼 때려버려! 미드필더가 골 맛을 봐야 상대 수비가 앞으로 튀어나온다.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "secondaryGroup": "FW",
          "secondaryGroupDelta": 1,
          "reactionText": "🔥 중거리 슈팅 허락에 미드필더들이 신나서 슈팅 폼을 점검합니다."
        },
        "riskLabel": "도박 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 중거리 슛 장려에 패스 타이밍이 엇갈릴까 봐 미드필더들이 전술 혼란을 느낍니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_08_mf_cup_battle",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "MF",
    "trigger": "cup_or_ucl",
    "title": "토너먼트 중원 사활전 브리핑",
    "speakerLabel": "토너먼트 라커룸 · 미드필더진 (MF)",
    "prompt": "토너먼트 단판·결승전급 경기에서는 세컨드볼 하나가 운명을 가릅니다. 미드필더진에게 마지막 당부를 건넵니다.",
    "choices": [
      {
        "id": "a",
        "label": "세컨드볼 사수 명령",
        "toneTag": "투지 주입",
        "quote": "\"오늘 하늘에서 떨어지는 공은 전부 우리 거야! 50대50 경합에서 한 발짝 먼저 들어가는 쪽이 8강·4강 티켓 가져간다. 절대 물러서지 마!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 강렬한 투지 주입에 미드필더들이 축구화 끈을 바짝 조여 멥니다!"
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 거친 세컨드볼 육탄전 주문에 카드 수집과 부상을 걱정하는 눈빛이 스칩니다."
        }
      },
      {
        "id": "b",
        "label": "베테랑급 침착함 주문",
        "toneTag": "냉철함",
        "quote": "\"토너먼트 초반엔 상대가 흥분해서 달려들 거야. 첫 15분만 여유롭게 패스 돌리면서 힘 빼놔. 그럼 후반엔 우리 놀이터가 된다.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 노련한 게임 플랜에 미드필더진이 침착하고 단단한 표정을 짓습니다."
        }
      },
      {
        "id": "c",
        "label": "숨은 영웅 찬사",
        "toneTag": "감성 자극",
        "quote": "\"내일 신문 1면엔 골 넣은 공격수 사진이 실리겠지. 근데 이 경기를 진짜 이겨낸 영웅이 너희라는 건 나랑 팀원 전부가 안다. 믿고 맡긴다!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 가슴을 울리는 한마디에 미드필더진의 충성심과 투지가 불타오릅니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_09_df_clean_sheet_reward",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "DF_GK",
    "trigger": "clean_sheet_streak",
    "title": "연속 무실점 수비진·GK 포상 & 방심 경고",
    "speakerLabel": "라커룸 포지션 미팅 · 수비진·GK",
    "prompt": "최근 {streak}경기 연속 무실점! 상대 공격수들을 완전히 꽁꽁 묶어버린 수비진과 골키퍼가 뿌듯한 표정으로 모여 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "클린시트 특별 포상 & 극찬",
        "toneTag": "화끈한 포상",
        "quote": "\"솔직히 요즘 우리 골대 앞에 벽돌 쌓아 놓은 줄 알았어! 공격수들이 골 넣으면 멋있긴 한데, 우승 트로피는 결국 너희 같은 철벽 수비가 들어 올리는 거야. 오늘 저녁은 수비진·키퍼가 메뉴 골라!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 골키퍼와 수비수들이 하이파이브를 하며 철벽 수비 라인의 자부심을 만끽합니다!"
        }
      },
      {
        "id": "b",
        "label": "카테나치오식 방심 경계",
        "toneTag": "집중 유지",
        "quote": "\"너무 잘해주고 있어. 근데 수비수는 89분 완벽해도 90분에 1초 딴생각하면 욕먹는 잔인한 자리잖아. 연속 무실점 기록? 깨질 때까지 악착같이 지켜보자!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 날카로운 프로 의식 환기에 수비진이 더욱 단단한 집중력을 유지합니다."
        },
        "riskLabel": "역효과 주의 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 잘 막고 있는 수비진에게 너무 깐깐하게 경고하자 분위기가 살짝 얼어붙습니다."
        }
      },
      {
        "id": "c",
        "label": "골키퍼 실업자 만들기 유머",
        "toneTag": "유쾌한 드립",
        "quote": "\"수비수들, 너무 잘 막아서 우리 골키퍼 경기 중에 심심해서 커피 마실 판이야! 다음 경기에도 키퍼 장갑에 먼지 한 톨 안 묻게 만들어 줘!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 골키퍼가 \"저는 심심한 게 제일 좋습니다!\"라며 폭소하고 수비진 분위기가 최고조가 됩니다!"
        }
      }
    ]
  },
  {
    "id": "lr_pos_10_df_conceded_fix",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "DF_GK",
    "trigger": "conceded_many",
    "title": "대량 실점 직후 수비진·GK 긴급 미팅",
    "speakerLabel": "라커룸 포지션 미팅 · 수비진·GK",
    "prompt": "오늘 여러 골을 내주며 수비수들과 골키퍼의 고개가 푹 숙어 있습니다. 서로 미안해하며 분위기가 가라앉아 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "소통(콜 플레이) 강화 + 격려",
        "toneTag": "따뜻한 교정",
        "quote": "\"실점했다고 서로 눈치 보지 마. 오늘 문제는 실력이 아니라 목소리가 작았던 거야. 다음 경기엔 목 쉴 정도로 소리 질러! '내가 본다!', '라인 올려!' — 소통만 살아나면 바로 철벽 복귀야.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 서로 탓하지 않고 콜 플레이를 약속하며 수비진과 골키퍼의 호흡이 되살아납니다!"
        }
      },
      {
        "id": "b",
        "label": "퍼거슨식 수비 기강 잡기",
        "toneTag": "강력 질책",
        "riskLabel": "하이리스크 (55%)",
        "successChance": 0.55,
        "quote": "\"박스 안에서 상대 공격수한테 레드카펫 깔아줄 거야?! 공보다 사람이 지나가도 괜찮다는 투지로 붙어! 다음 경기에도 이렇게 쉽게 뚫리면 라인 전부 바꾼다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 서늘한 일침에 수비진의 눈빛이 독하게 변합니다! \"다음 경기 무조건 클린시트 합니다!\""
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 가뜩이나 위축된 수비진과 골키퍼가 더욱 경직되고 자신감을 잃습니다."
        }
      },
      {
        "id": "c",
        "label": "골키퍼·수비수 신뢰 재확인",
        "toneTag": "멘탈 보호",
        "quote": "\"한 경기 많이 먹혔다고 우리가 약한 수비진이 되는 건 아니야. 오늘 실수는 깔끔하게 잊고 다음 경기 0-0부터 다시 보여줘. 난 너희를 믿어.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 변함없는 신뢰에 골키퍼와 수비수들이 안도하며 멘탈을 회복합니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_11_df_high_line_courage",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "DF_GK",
    "trigger": "any",
    "title": "후방 빌드업 & 라인 컨트롤 미팅",
    "speakerLabel": "라커룸 포지션 미팅 · 수비진·GK",
    "prompt": "상대의 전방 압박이 거세질수록 골키퍼와 수비진의 후방 빌드업 용기가 중요해집니다.",
    "choices": [
      {
        "id": "a",
        "label": "빌드업 실수 책임 면제 선언",
        "toneTag": "자신감 해방",
        "quote": "\"후방에서 패스 돌리다 실수해서 골 먹으면? 그건 100% 내 책임이야. 겁먹고 뻥뻥 차기만 하지 말고 너희 발밑 기술을 믿고 침착하게 풀어 나와!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 감독의 책임 면제 선언에 수비수와 골키퍼가 여유로운 표정으로 자신감을 얻습니다!"
        }
      },
      {
        "id": "b",
        "label": "안전 제일 — 위험하면 시원하게 걷어내라",
        "toneTag": "실리 안전",
        "quote": "\"멋있게 돌리려다 헌납하는 것보다 관중석 2층으로 시원하게 날려버리는 게 백 번 낫다! 위험 신호 오면 주저하지 말고 확실하게 끊어!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 명쾌한 기준에 수비진이 부담 없이 단단한 수비를 준비합니다."
        }
      },
      {
        "id": "c",
        "label": "공격 가담 헤더 골 보너스 약속",
        "toneTag": "세트피스 동기부여",
        "quote": "\"수비만 잘해도 최고지만, 코너킥 올라가서 수비수가 헤더 골 박으면 라커룸 분위기 끝장나잖아? 다음 경기 수비수 득점하면 특별 포상 나간다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 센터백들이 서로 \"다음 코너킥은 내 거다!\"라며 신나게 웃습니다!"
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 공격 가담 주문에 뒷공간 털릴까 봐 센터백과 풀백 사이에 불안감이 감돕니다."
        }
      }
    ]
  },
  {
    "id": "lr_pos_12_df_star_striker_lockdown",
    "category": "locker_room",
    "targetScope": "position_group",
    "positionGroup": "DF_GK",
    "trigger": "big_match",
    "title": "{opponentName} 특급 공격진 봉쇄 작전",
    "speakerLabel": "빅매치 라커룸 · 수비진·GK",
    "prompt": "화려한 공격진을 자랑하는 {opponentName}과의 결전을 앞두고 수비진과 골키퍼가 전의를 다지고 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "\"상대 에이스를 지워버려라\"",
        "toneTag": "승부욕 자극",
        "quote": "\"언론이 온통 {opponentName} 공격수들 찬양 기사만 쓰던데? 오늘 너희가 걔네 90분 내내 투명인간 만들어 버리면 내일 1면은 너희 차지야. 주머니에 쏙 넣고 와!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 승부욕이 폭발한 수비진과 골키퍼가 \"오늘 슈팅 각도조차 안 주겠다\"며 투지를 불태웁니다!"
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ \"상대 에이스를 완벽히 지워라\"는 미션이 지나친 부담으로 다가와 수비진이 경직됩니다."
        }
      },
      {
        "id": "b",
        "label": "협력 수비 & 커버 플레이 강조",
        "toneTag": "조직력 극대화",
        "quote": "\"일대일로 혼자 영웅 되려 하지 마. 한 명 뚫리면 바로 옆 동료가 지워주는 거야. 4명, 5명이 한 몸처럼 움직이면 어떤 슈퍼스타도 못 뚫어.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 단단한 협력 수비 약속에 수비라인의 신뢰감이 깊어집니다."
        }
      },
      {
        "id": "c",
        "label": "골키퍼 특급 선방 쇼 기대",
        "toneTag": "GK 신뢰",
        "quote": "\"혹시 한두 번 뚫려도 우리 뒤에 철벽 수문장이 있잖아! 수비수는 몸 날리고, 키퍼는 손끝으로 쳐내면서 오늘 인생 방어전 한번 찍어 보자!\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 골키퍼가 장갑을 탁 치며 \"뒤는 저한테 맡기세요!\"라고 외칩니다!"
        }
      }
    ]
  },
  {
    "id": "lr_plr_01_injury_cover_encourage",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "player_injury_cover",
    "title": "주전 부상 대체 투입 앞둔 {playerName}",
    "speakerLabel": "라커룸 1:1 면담 · {playerName}",
    "prompt": "경기 전 복도에서 {playerName}이(가) 평소보다 긴장한 표정으로 테이핑을 감고 있습니다. 주전 부상 공백을 메워야 한다는 부담감이 역력합니다.",
    "choices": [
      {
        "id": "a",
        "label": "따뜻한 신뢰 & 주연 선언",
        "toneTag": "따뜻한 독려",
        "quote": "\"{playerName}, 땜빵으로 나가는 거 아니야. 네가 훈련장에서 흘린 땀 때문에 내가 고민 없이 네 이름을 선발에 적은 거야. 오늘 경기장 주연은 너니까 쫄지 말고 네 플레이 다 보여줘.\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 {playerName}의 눈가가 살짝 뜨거워지며 \"감독님, 절대 후회 안 하시게 뛰겠습니다!\"라고 외칩니다."
        }
      },
      {
        "id": "b",
        "label": "유쾌한 긴장 완화 드립",
        "toneTag": "유쾌한 드립",
        "quote": "\"야 {playerName}, 표정이 무슨 챔스 결승 90분 PK 차러 가는 사람 같아. 실수해도 괜찮아, 어차피 카메라엔 벤치에서 소리 지르는 내 얼굴이 더 웃기게 잡힐 거거든. 편하게 뛰어!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 긴장이 풀린 {playerName}이(가) 웃음을 터뜨리며 힘차게 하이파이브를 건넵니다."
        }
      },
      {
        "id": "c",
        "label": "야망 자극 (주전 쟁탈전 선언)",
        "toneTag": "야망 자극",
        "riskLabel": "하이리스크 (70%)",
        "successChance": 0.7,
        "quote": "\"기회는 항상 남의 불행에서 오지. 오늘 {opponentName} 상대로 인생 경기 찍어 봐. 부상 선수 돌아와도 못 빼게 만들면 네 자리가 되는 거야.\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 {playerName}의 눈빛이 맹수처럼 바뀝니다. \"오늘 제 자리로 못 박아 두겠습니다.\""
        },
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ \"인생 경기\"라는 말에 {playerName}이(가) 살짝 부담을 느끼며 침을 삼킵니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_02_poor_rating_hairdryer",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "player_poor_rating",
    "title": "평점 5점대 최악 부진 — {playerName} 1:1 면담",
    "speakerLabel": "경기 후 1:1 면담 · {playerName}",
    "prompt": "경기가 끝난 뒤 {playerName}이(가) 라커룸 구석에 고개를 파묻고 앉아 있습니다. 팬들과 언론의 혹평이 쏟아질 것이 뻔한 최악의 하루였습니다.",
    "choices": [
      {
        "id": "a",
        "label": "퍼거슨식 풀파워 헤어드라이어",
        "toneTag": "헤어드라이어",
        "riskLabel": "하이리스크 하이리턴 (55%)",
        "successChance": 0.55,
        "quote": "\"{playerName}! 고개 들어, 지금 나랑 눈 마주쳐! 오늘 90분 동안 경기장에서 산책하러 왔어?! 네 이름값 믿고 선발 넣은 동료들 얼굴을 좀 봐! 다음 경기에서도 이따위 집중력이면 벤치도 아까워, 정신 똑바로 차려!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 {playerName}이(가) 입술을 꽉 깨물더니 \"죄송합니다, 다음 경기에서 죽기 살기로 갚겠습니다\"라며 곧장 추가 훈련장으로 향합니다! (충격 각성!)"
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ {playerName}이(가) 굳은 표정으로 라커룸 문을 세게 닫고 나갑니다. 선수단 공기가 싸늘해졌습니다."
        }
      },
      {
        "id": "b",
        "label": "1:1 냉정한 전술 피드백 + 신뢰",
        "toneTag": "따뜻한 교정",
        "quote": "\"{playerName}, 오늘 경기 망친 건 너도 알고 나도 알아. 근데 한 경기 못했다고 네 실력이 어디 가는 건 아니야. 이따 영상 보면서 위치 선정 두 장면만 짚고 잊어버려. 다음 경기에도 난 너 믿고 쓴다.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 {playerName}이(가) 깊게 숨을 내쉬며 고개를 끄덕입니다. \"감독님, 영상 같이 봐주셔서 감사합니다. 바로 만회하겠습니다.\""
        }
      },
      {
        "id": "c",
        "label": "유머 섞인 따끔한 뼈 때리기",
        "toneTag": "유쾌한 일침",
        "quote": "\"{playerName}, 오늘 상대 선수랑 베프 먹으러 나간 줄 알았어. 너무 착하게 공을 양보하더라? 착한 건 경기장 밖에서만 하고, 다음 경기에선 좀 못되게 뛰어라.\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 {playerName}이(가) 멋쩍게 웃으며 \"다음엔 진짜 악착같이 뛰겠습니다\"라고 답하자 주변 동료들도 어깨를 두드려 줍니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_03_goal_drought_talk",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "player_goal_drought",
    "title": "골 가뭄에 빠진 {playerName} 개별 면담",
    "speakerLabel": "훈련장 1:1 면담 · {playerName}",
    "prompt": "훈련이 끝난 뒤에도 {playerName}이(가) 혼자 남아 빈 골대에 슈팅을 때리고 있습니다. 몇 경기째 터지지 않는 골 때문에 표정이 어둡습니다.",
    "choices": [
      {
        "id": "a",
        "label": "옆에 앉아 부담 털어주기",
        "toneTag": "멘탈 케어",
        "quote": "\"그만 차고 공 내려놔, 내일 다리 풀린다. 골대랑 원수 졌어? 잘하려는 욕심 때문에 힘이 잔뜩 들어갔잖아. 다음 경기엔 골 생각 말고 그냥 제일 좋아하는 슈팅 한 번만 때려봐. 무조건 들어간다.\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 힘 빼라는 조언에 {playerName}의 굳어 있던 어깨가 스르르 풀리며 미소를 되찾습니다!"
        }
      },
      {
        "id": "b",
        "label": "강력한 킬러 본능 채찍질",
        "toneTag": "강한 자극",
        "riskLabel": "하이리스크 (60%)",
        "successChance": 0.6,
        "quote": "\"네가 이 팀 주포인데 이렇게 침묵하면 팀이 어떻게 우승해? 동정표 바라지 마. 다음 {opponentName}전에서 기어이 골망 찢어놓고 포효해 봐!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 독기가 오른 {playerName}이(가) \"다음 경기 첫 골은 제 겁니다\"라며 불타오릅니다!"
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 이미 자책하던 {playerName}에게 압박이 겹치며 얼굴이 어두워집니다."
        }
      },
      {
        "id": "c",
        "label": "감독 직접 골키퍼 서주기",
        "toneTag": "유쾌한 소통",
        "quote": "\"야, 빈 골대에 차니까 재미없지? 내가 장갑 낄 테니까 나 상대로 3골만 넣고 퇴근해! 못 넣으면 내일 커피 쏘기다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 감독이 몸을 날리며 어설프게 다이빙하자 {playerName}이(가) 박장대소하며 슈팅 감각을 되찾습니다!"
        }
      }
    ]
  },
  {
    "id": "lr_plr_04_mom_celebration",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "player_mom_or_hattrick",
    "title": "인생 경기 폭발! {playerName} 특급 치하",
    "speakerLabel": "경기 후 라커룸 · {playerName}",
    "prompt": "경기 최우수 선수(MOM) 트로피를 손에 쥔 {playerName}이(가) 라커룸으로 들어오자 동료들이 물을 뿌리며 환호합니다!",
    "choices": [
      {
        "id": "a",
        "label": "뜨거운 포옹 & 월드클래스 인정",
        "toneTag": "최고의 칭찬",
        "quote": "\"{playerName}, 오늘 넌 진짜 미쳤어! 경기장 전체가 네 무대였잖아. 이런 날은 겸손 떨지 말고 마음껏 폼 잡아도 돼. 진짜 최고였다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 {playerName}이(가) 활짝 웃으며 최고의 자신감과 에너지로 충만해집니다!"
        }
      },
      {
        "id": "b",
        "label": "유머러스한 도핑 테스트 드립",
        "toneTag": "유쾌한 드립",
        "quote": "\"야 {playerName}, 오늘 뭐 먹고 나왔냐? 이따 협회에서 도핑 검사 나오면 나 모른 척한다! 농담이고, 덕분에 나도 명장 소리 좀 듣겠다, 고맙다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 라커룸 전체가 웃음바다가 되며 {playerName}과(와) 팀 분위기 모두 급상승합니다!"
        }
      },
      {
        "id": "c",
        "label": "더 높은 기준 제시 (연속 활약 요구)",
        "toneTag": "야망 자극",
        "quote": "\"오늘 진짜 환상적이었어. 근데 한 번 반짝하는 선수는 많아. 다음 {opponentName}전에서도 오늘처럼 지배하면 진짜 괴물 되는 거야. 기대할게!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 {playerName}이(가) 들뜨지 않고 \"다음 경기에도 똑같이 보여드리겠습니다!\"라며 눈을 빛냅니다."
        },
        "riskLabel": "역효과 주의 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 인생 경기를 펼치고도 더 높은 기준만 요구받자 {playerName}이(가) 살짝 허탈해합니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_05_bench_unhappy_talk",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "player_bench_unhappy",
    "title": "연속 벤치 결장 불만 — {playerName} 면담 요청",
    "speakerLabel": "감독실 1:1 면담 · {playerName}",
    "prompt": "{playerName}이(가) 감독실 문을 두드렸습니다. \"감독님, 저 컨디션 완벽한데 계속 벤치에만 앉아 있는 게 힘듭니다. 솔직히 이유를 알고 싶습니다.\"",
    "choices": [
      {
        "id": "a",
        "label": "진심 어린 설명 & 로테이션 약속",
        "toneTag": "신뢰 소통",
        "quote": "\"솔직하게 말해줘서 고맙다, {playerName}. 네 실력이 부족해서 뺀 게 아니야. 다가오는 빡빡한 일정에서 네가 결정적인 역할을 해야 해서 아껴둔 거야. 곧 선발 기회 줄 테니 몸 최상으로 유지해.\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 진심 어린 대화에 {playerName}의 굳었던 표정이 풀리며 \"알겠습니다 감독님, 준비하고 있겠습니다!\"라고 답합니다."
        }
      },
      {
        "id": "b",
        "label": "슈퍼 조커의 가치 강조",
        "toneTag": "역할 부여",
        "quote": "\"선발 11명이 문 두드리고 지치게 만들면, 65분에 들어가서 게임 끝내주는 '게임 체인저'가 제일 무서운 법이야. 네가 그 역할에 완벽해. 자부심 가져!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 \"게임 체인저\"라는 역할 부여에 {playerName}이(가) 고개를 끄덕이며 의욕을 되찾습니다."
        }
      },
      {
        "id": "c",
        "label": "퍼거슨식 단호한 경쟁 원칙",
        "toneTag": "기강 확립",
        "riskLabel": "하이리스크 (50%)",
        "successChance": 0.5,
        "quote": "\"불만 있는 건 이해해. 근데 내 방 문 두드릴 시간에 훈련장에서 주전 선수 자리 뺏을 실력을 보여줘. 훈련장 1등이 선발 나간다.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 승부욕이 자극된 {playerName}이(가) \"훈련장에서 실력으로 증명하겠습니다!\"라며 눈빛을 불태웁니다."
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 차가운 답변에 {playerName}이(가) 실망한 표정으로 말없이 감독실을 나갑니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_06_ace_big_match_talk",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "player_big_game_ace",
    "title": "빅매치 결전 앞둔 에이스 {playerName}",
    "speakerLabel": "경기 직전 1:1 대화 · {playerName}",
    "prompt": "{opponentName}과의 운명의 빅매치를 앞두고, 팀의 핵심 에이스 {playerName}이(가) 조용히 헤드폰을 벗으며 집중하고 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "\"오늘은 네가 왕이라는 걸 보여줘\"",
        "toneTag": "에이스 대우",
        "quote": "\"{playerName}, 상대 수비수들 지금 터널에서 네 이름 얘기하면서 긴장하고 있을 거야. 오늘 경기장 주인이 누군지 첫 터치부터 똑똑히 각인시켜 줘. 넌 이런 큰 무대 체질이잖아!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 {playerName}이(가) 자신만만한 미소를 지으며 \"오늘 제가 끝내겠습니다\"라고 답합니다!"
        },
        "riskLabel": "도박 (65%)",
        "successChance": 0.65,
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ \"오늘은 네가 왕\"이라는 스포트라이트가 과한 부담으로 돌아와 {playerName}이(가) 긴장합니다."
        }
      },
      {
        "id": "b",
        "label": "혼자 짊어지지 말라는 따뜻한 배려",
        "toneTag": "부담 완화",
        "quote": "\"에이스라고 혼자 다 해결하려 하지 마. 상대가 너한테 두세 명 몰리면 가볍게 동료한테 툭 내줘. 네가 미끼가 되든 해결사가 되든, 편하게 즐기면 무조건 이긴다.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 부담을 내려놓은 {playerName}이(가) 여유롭게 몸을 풀며 최고의 집중력을 보입니다."
        }
      },
      {
        "id": "c",
        "label": "유쾌한 골 세리머니 주문",
        "toneTag": "유쾌한 드립",
        "quote": "\"오늘 골 넣고 카메라 앞에서 멋있는 세리머니 하나 준비해 뒀지? 설마 또 평범하게 뛰기만 하는 건 아니지? 오늘 꼭 보고 싶다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 {playerName}이(가) 웃으며 \"감독님 벤치 앞으로 뛰어갈 테니 피하지 마세요!\"라고 농담합니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_07_injury_return_welcome",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "player_returning_injury",
    "title": "부상 복귀 {playerName} 1:1 체크인",
    "speakerLabel": "라커룸 1:1 면담 · {playerName}",
    "prompt": "부상을 털어내고 돌아온 {playerName}이(가) 오랜만에 경기용 유니폼을 입으며 설렘 반, 재부상 걱정 반의 표정을 짓고 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "천천히 감각 올리라는 따뜻한 배려",
        "toneTag": "따뜻한 보호",
        "quote": "\"돌아와서 진짜 반갑다, {playerName}! 첫 경기부터 무리해서 전력 질주할 필요 없어. 조금이라도 뻐근하면 바로 손 들어. 천천히 네 리듬만 찾아도 팀엔 엄청난 힘이야.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 재부상 두려움이 컸던 {playerName}이(가) 크게 안도하며 활짝 웃습니다!"
        }
      },
      {
        "id": "b",
        "label": "팀원들 앞 환영 박수 이벤트",
        "toneTag": "라커룸 화합",
        "quote": "\"다들 잠깐 주목! 우리 {playerName}이(가) 드디어 의무실 탈출해서 돌아왔다! 복귀 기념으로 박수 한 번 쳐주자!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 라커룸에 우레와 같은 박수가 터지자 {playerName}이(가) 쑥스러워하면서도 큰 힘을 얻습니다."
        }
      },
      {
        "id": "c",
        "label": "밀린 활약 몰아서 터뜨리자 농담",
        "toneTag": "유쾌한 독려",
        "quote": "\"의무실 밥이 그렇게 맛있었냐? 그동안 못 뛴 만큼 남은 경기에서 몰아서 맹활약할 준비됐지? 가자!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 {playerName}이(가) \"밀린 숙제 한 번에 다 하겠습니다!\"라며 웃음 짓습니다."
        },
        "riskLabel": "역효과 주의 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 복귀하자마자 밀린 활약까지 요구하는 농담에 {playerName}이(가) 재부상 걱정을 떠올립니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_08_fatigue_overwork_care",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "fatigue_overload",
    "title": "혹사 중인 철강왕 {playerName} 면담",
    "speakerLabel": "라커룸 1:1 대화 · {playerName}",
    "prompt": "연속 출전으로 피로도가 꽤 쌓인 {playerName}이(가) 얼음찜질을 하면서도 \"감독님, 저 다음 경기도 뛸 수 있습니다\"라고 말합니다.",
    "choices": [
      {
        "id": "a",
        "label": "헌신에 감사 + 스마트한 휴식 약속",
        "toneTag": "세심한 관리",
        "quote": "\"네 투지는 진짜 박수 받아 마땅해, {playerName}. 근데 넌 시즌 끝까지 쓰러지면 안 되는 핵심이야. 무리하다 다치면 둘 다 손해니까 내가 타이밍 봐서 확실히 쉬게 해줄게. 고맙다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 자신의 몸을 진심으로 걱정해 주는 감독에게 {playerName}이(가) 깊은 신뢰를 느낍니다."
        }
      },
      {
        "id": "b",
        "label": "투혼 극찬 (\"네가 팀의 기준이다\")",
        "toneTag": "리더 대우",
        "quote": "\"다들 힘들다고 할 때 먼저 뛰겠다고 나서는 네 태도가 이 라커룸의 기준이야. 진짜 프로다. 오늘도 힘내줘!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 자부심이 충만해진 {playerName}과(와) 동료들이 함께 투지를 끌어올립니다."
        },
        "riskLabel": "역효과 주의 (55%)",
        "successChance": 0.55,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ \"쉴 줄 알았는데 또 뛰라고요?\" 투혼 극찬 뒤에 휴식 약속이 없자 {playerName}의 어깨가 축 처집니다."
        }
      },
      {
        "id": "c",
        "label": "강제 회복 명령 유머",
        "toneTag": "유쾌한 배려",
        "quote": "\"야, 너 혹시 몰래 배터리 갈아 끼우고 다니냐? 투지는 100점인데 오늘은 야간 훈련 금지! 집 가서 10시간 푹 자고 와, 감독 명령이다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 {playerName}이(가) 피식 웃으며 \"알겠습니다, 오늘 꿀잠 자고 오겠습니다!\"라고 답합니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_09_training_lazy_warning",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "any",
    "title": "훈련 태도 해이해진 {playerName} 호출",
    "speakerLabel": "훈련장 1:1 호출 · {playerName}",
    "prompt": "오늘 훈련에서 {playerName}의 집중력이 평소보다 눈에 띄게 떨어지고, 패스 미스 후 설렁설렁 걷는 모습이 포착됐습니다.",
    "choices": [
      {
        "id": "a",
        "label": "퍼거슨식 훈련장 불호령",
        "toneTag": "헤어드라이어",
        "riskLabel": "하이리스크 (60%)",
        "successChance": 0.6,
        "quote": "\"{playerName}, 잠깐 이리 와! 훈련을 그 따위로 설렁설렁하면 경기장에서 마법처럼 잘 될 줄 알아?! 땀 안 흘릴 거면 지금 당장 조끼 벗고 들어가!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 호통에 정신이 번쩍 든 {playerName}이(가) 남은 훈련 동안 누구보다 미친 듯이 뛰어다닙니다!"
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 공개적인 호통에 {playerName}의 기분이 상해 훈련 내내 표정이 굳어 있습니다."
        }
      },
      {
        "id": "b",
        "label": "무슨 고민 있는지 먼저 묻기",
        "toneTag": "감성 리더십",
        "quote": "\"{playerName}, 오늘 평소 너답지 않더라. 몸이 좀 안 좋은 거야, 아니면 개인적으로 신경 쓰이는 일 있어? 편하게 얘기해, 내가 도울 수 있으면 도울게.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 따뜻한 관심에 {playerName}이(가) 마음을 열며 \"별일 아닙니다, 바로 집중하겠습니다!\"라며 눈빛을 고쳐 잡습니다."
        }
      },
      {
        "id": "c",
        "label": "유머로 슬쩍 경고 주기",
        "toneTag": "위트 경고",
        "quote": "\"야 {playerName}, 오늘 훈련장이 공원 산책로인 줄 알았어? 발에 슬리퍼 신은 줄! 내일부턴 다시 축구화 신고 전력으로 뛰자, 알겠지?\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "reactionText": "🔥 부드러우면서도 뼈 있는 농담에 {playerName}이(가) 멋쩍게 웃으며 바로 페이스를 올립니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_10_clutch_mistake_console",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "lose_streak",
    "title": "치명적 실수 자책 중인 {playerName}",
    "speakerLabel": "라커룸 1:1 대화 · {playerName}",
    "prompt": "직전 경기에서 뼈아픈 실수를 범한 {playerName}이(가) 라커룸에서 혼자 자책하며 동료들의 눈을 피하고 있습니다.",
    "choices": [
      {
        "id": "a",
        "label": "실수보다 도전 정신 격려",
        "toneTag": "따뜻한 위로",
        "quote": "\"{playerName}, 세계 최고 선수들도 결승전에서 페널티 실축하고 백패스 미스해. 실수 안 하는 선수는 숨어 다니는 선수뿐이야. 고개 들어, 다음 경기에서 네가 영웅 되면 다 잊혀져.\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 진심 어린 위로에 {playerName}의 눈빛이 살아납니다. \"감독님, 다음 경기 꼭 갚겠습니다.\""
        }
      },
      {
        "id": "b",
        "label": "냉정하게 털고 일어나라는 채찍",
        "toneTag": "강한 자극",
        "riskLabel": "하이리스크 (60%)",
        "successChance": 0.6,
        "quote": "\"우울해한다고 실수가 취소돼? 미안하면 거기 앉아 있지 말고 경기장에서 미친 듯이 뛰어서 갚아! 프로는 결과로 사과하는 거야!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 단호한 한마디에 {playerName}이(가) 자책을 멈추고 강한 승부욕으로 무장합니다!"
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 이미 멘탈이 흔들리던 {playerName}이(가) 더 깊이 위축됩니다."
        }
      },
      {
        "id": "c",
        "label": "동료들과의 화합으로 분위기 전환",
        "toneTag": "팀 케어",
        "quote": "\"축구는 11명이 같이 지고 같이 이기는 거야. 네 탓 아니야. 이따 팀원들이랑 밥 먹으면서 웃고 털어버려. 다들 너 믿고 있어.\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 주변 동료들이 {playerName}의 등을 두드려 주며 따뜻한 동료애가 살아납니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_11_captain_leadership",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "any",
    "title": "라커룸 리더 {playerName}에게 역할 요청",
    "speakerLabel": "라커룸 1:1 대화 · {playerName}",
    "prompt": "시즌의 중요한 시점을 맞아, 영향력 있는 핵심 선수 {playerName}에게 라커룸 분위기를 이끌어 달라고 부탁하려 합니다.",
    "choices": [
      {
        "id": "a",
        "label": "피치 위 리더십 공식 신뢰",
        "toneTag": "리더 임명",
        "quote": "\"{playerName}, 애들이 흔들릴 때 제일 먼저 눈을 보는 사람이 너야. 경기장에서 분위기 처진다 싶으면 네가 제일 크게 소리 질러줘. 라커룸 리더 역할, 믿고 맡긴다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 막중한 신뢰에 {playerName}이(가) 가슴을 펴며 팀 전체 분위기를 든든하게 이끌기 시작합니다!"
        }
      },
      {
        "id": "b",
        "label": "어린/백업 선수 멘토링 부탁",
        "toneTag": "팀 케미 강화",
        "quote": "\"네 경험이 팀에 진짜 보물이야. 요즘 벤치에서 기회 기다리는 동료들한테 한마디씩 챙겨주면 팀이 훨씬 단단해질 거야. 부탁해도 될까?\"",
        "successEffect": {
          "targetMoraleDelta": 1,
          "benchMoraleDelta": 2,
          "reactionText": "🔥 {playerName}이(가) 벤치 멤버들과 어울리며 조언을 건네자 스쿼드 전체 사기가 올라갑니다."
        }
      },
      {
        "id": "c",
        "label": "솔선수범 플레이 주문",
        "toneTag": "실력 리딩",
        "quote": "\"말 백 마디보다 네가 경기장에서 한 발 더 뛰는 모습이 동료들한테 최고 자극이야. 다음 경기에서 클래스로 팀을 끌고 가줘!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 {playerName}이(가) 묵직하게 고개를 끄덕이며 솔선수범을 다짐합니다."
        },
        "riskLabel": "역효과 주의 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ \"실력으로 증명해서 이끌어라\"는 직설적인 주문에 {playerName}이(가) 무거운 책임감을 느낍니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_12_ucl_revenge_fire",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "cup_or_ucl",
    "title": "큰 무대 앞둔 {playerName} 투지 점화",
    "speakerLabel": "토너먼트 1:1 대화 · {playerName}",
    "prompt": "수많은 팬들이 지켜보는 토너먼트 빅매치 직전, {playerName}이(가) 경기장 잔디를 바라보며 깊은 숨을 고릅니다.",
    "choices": [
      {
        "id": "a",
        "label": "\"네 이름을 유럽 전역에 새겨라\"",
        "toneTag": "명장 격려",
        "quote": "\"{playerName}, 오늘 전 세계 축구 팬들이 이 경기를 보고 있어. 하이라이트 썸네일에 네 얼굴 박히게 한 방 제대로 터뜨려 보자. 넌 할 수 있어!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 \"하이라이트 썸네일\"이라는 말에 {playerName}의 눈빛이 뜨겁게 타오릅니다!"
        },
        "riskLabel": "도박 (65%)",
        "successChance": 0.65,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ \"유럽 전역에 이름을 새겨라\"는 비장한 주문에 {playerName}의 심박수가 너무 올라가 버렸습니다."
        }
      },
      {
        "id": "b",
        "label": "평소처럼만 하면 충분하다 안심",
        "toneTag": "차분한 신뢰",
        "quote": "\"큰 경기라고 무리해서 평소 안 하던 개인기 쓰지 마. 네 기본 클래스만 나와도 상대는 못 막아. 평소대로 침착하게 가자!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 차분한 조언에 {playerName}이(가) 흔들림 없는 평정심을 되찾습니다."
        }
      },
      {
        "id": "c",
        "label": "승부차기 키커 1번 예약 유머",
        "toneTag": "강심장 농담",
        "quote": "\"만약 오늘 승부차기 가면 1번 키커는 무조건 너다! 아, 부담되면 그냥 90분 안에 네가 결승골 넣고 끝내버려!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 {playerName}이(가) 웃으며 \"승부차기 안 가게 90분 안에 끝내겠습니다!\"라고 답합니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_13_transfer_noise_focus",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "transfer_rumor",
    "title": "이적설 흔들리는 {playerName} 단도리",
    "speakerLabel": "라커룸 1:1 면담 · {playerName}",
    "prompt": "최근 {playerName}의 이름을 건 이적 루머 기사가 연일 쏟아지며 선수 본인의 집중력이 약간 흔들리는 듯 보입니다.",
    "choices": [
      {
        "id": "a",
        "label": "확실한 팀 내 위상 보장",
        "toneTag": "확고한 신뢰",
        "quote": "\"신문 기사 신경 쓰지 마, {playerName}. 내 구상에서 넌 대체 불가능한 핵심이야. 여기서 나랑 같이 트로피 들어 올릴 거잖아? 핸드폰 끄고 축구만 즐기자!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 감독의 확실한 믿음에 {playerName}이(가) 마음을 굳히며 흔들림을 털어냅니다!"
        }
      },
      {
        "id": "b",
        "label": "몸값 올리려면 여기서 잘해야지 드립",
        "toneTag": "유쾌한 현실론",
        "quote": "\"빅클럽들이 너 탐낸다니 내 안목이 정확했네! 근데 알지? 여기서 트로피 들고 맹활약해야 네 가치가 더 올라가는 거야. 이적설 따위 경기력으로 눌러버려!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 쿨한 반응에 {playerName}이(가) 웃으며 훈련 집중력을 확 끌어올립니다."
        }
      },
      {
        "id": "c",
        "label": "잡음 차단 강력 경고",
        "toneTag": "프로 기강",
        "riskLabel": "하이리스크 (55%)",
        "successChance": 0.55,
        "quote": "\"지금 시즌 한복판이야! 이적설에 마음 뺏겨서 경기력 떨어지는 순간 바로 벤치행이다. 딴생각 말고 이 팀 유니폼에만 집중해!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 따끔한 경고에 {playerName}이(가) \"오해 없게 경기장에서 증명하겠습니다\"라며 정신을 다잡습니다."
        },
        "failEffect": {
          "targetMoraleDelta": -2,
          "reactionText": "❄️ 의심받는 기분에 {playerName}이(가) 서운함을 느끼며 표정이 어두워집니다."
        }
      }
    ]
  },
  {
    "id": "lr_plr_14_hidden_gem_praise",
    "category": "locker_room",
    "targetScope": "player",
    "trigger": "any",
    "title": "훈련장 에이스 {playerName} 깜짝 칭찬",
    "speakerLabel": "훈련 후 1:1 대화 · {playerName}",
    "prompt": "오늘 전술 훈련에서 {playerName}이(가) 환상적인 터치와 집중력으로 코칭스태프 전원의 감탄을 자아냈습니다.",
    "choices": [
      {
        "id": "a",
        "label": "진심 어린 폭풍 칭찬",
        "toneTag": "따뜻한 격려",
        "quote": "\"{playerName}, 오늘 훈련 폼 미쳤더라? 수석코치랑 보면서 '저 컨디션이면 다음 경기 무조건 사고 친다'고 얘기했어. 지금 감각 그대로 경기장까지 가져가자!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "reactionText": "🔥 깜짝 극찬에 {playerName}이(가) 귀까지 빨개지며 엄청난 자신감을 얻습니다!"
        }
      },
      {
        "id": "b",
        "label": "다음 경기 키플레이어 예고",
        "toneTag": "기대감 부여",
        "quote": "\"다음 {opponentName}전 전술의 핵심 키를 네가 쥐고 있어. 오늘 보여준 그 날카로움만 나오면 상대는 절대 못 막아. 기대할게!\"",
        "successEffect": {
          "targetMoraleDelta": 3,
          "reactionText": "🔥 중책을 맡았다는 자부심에 {playerName}의 눈이 반짝입니다."
        },
        "riskLabel": "도박 (60%)",
        "successChance": 0.6,
        "failEffect": {
          "targetMoraleDelta": -1,
          "reactionText": "❄️ 갑작스러운 키플레이어 예고에 아직 경험이 부족한 {playerName}이(가) 부담감을 느낍니다."
        }
      },
      {
        "id": "c",
        "label": "동료들 앞에서 모범 사례 칭찬",
        "toneTag": "팀 사기 동반 상승",
        "quote": "\"다들 {playerName} 오늘 훈련하는 거 봤지? 저렇게 100% 집중하면 경기력이 올라갈 수밖에 없어. 오늘 훈련 MVP는 {playerName}이다!\"",
        "successEffect": {
          "targetMoraleDelta": 2,
          "teamMoraleDelta": 1,
          "reactionText": "🔥 동료들의 환호 속에 {playerName}과(와) 팀 전체의 훈련 열기가 뜨거워집니다!"
        }
      }
    ]
  }
];
