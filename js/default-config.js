export const SESSION_ID = "venture-pick-2026";

export const DEFAULT_CONFIG = {
  sessionId: SESSION_ID,
  title: "Venture Pick",
  subtitle: "어떤 사업에 투자하시겠습니까?",
  description:
    "다른 팀의 사업을 살펴보고 가장 가능성이 있다고 생각하는 곳에 가상 투자금을 배분하세요. 투자하지 않고 남겨두는 금액도 선택입니다.",
  budget: 100000000,
  unit: 10000000,
  isOpen: false,
  updatedAtText: "",
  teamIds: ["team1", "team2", "team3", "team4"],
  teamCounts: {
    team1: 4,
    team2: 4,
    team3: 4,
    team4: 4
  },
  revision: "",
  teamPinHashes: {
    team1: "",
    team2: "",
    team3: "",
    team4: ""
  },
  teams: [
    {
      id: "team1",
      name: "1조",
      biz: "Local Loop",
      desc: "지역의 숨은 장소와 경험을 연결하는 여행 서비스",
      landingUrl: "landing/team1.html",
      thumbnail: "assets/team1.svg",
      accent: "#5b5cf0"
    },
    {
      id: "team2",
      name: "2조",
      biz: "Slow Stay",
      desc: "머무는 시간 자체를 콘텐츠로 만드는 로컬 체류 서비스",
      landingUrl: "landing/team2.html",
      thumbnail: "assets/team2.svg",
      accent: "#19a974"
    },
    {
      id: "team3",
      name: "3조",
      biz: "Trip Match",
      desc: "취향과 일정에 맞춰 여행 동선을 추천하는 맞춤형 서비스",
      landingUrl: "landing/team3.html",
      thumbnail: "assets/team3.svg",
      accent: "#f97316"
    },
    {
      id: "team4",
      name: "4조",
      biz: "Hidden Scene",
      desc: "잘 알려지지 않은 지역의 장면을 발견하게 하는 탐색 서비스",
      landingUrl: "landing/team4.html",
      thumbnail: "assets/team4.svg",
      accent: "#0284c7"
    }
  ]
};
