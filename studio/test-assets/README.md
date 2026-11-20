# 시험 사진 세트 (과업 B-04)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-11-20 |
| 작성 | 개발자 B 측 구현자 (Claude Code) |
| 관련 | `docs/deliverables/개발자B_작업지시서.md` B-04 · B-05(IT-01~IT-20) |

## 1. 목적

통합시험(B-05)과 카드뉴스 완성도 확인(B-01·B-02)에 쓰는 현장 사진 8장과 업로드 거부 확인용 파일을 한곳에 모았다.

> 이 README는 이 폴더 바로 아래의 파일만 다룬다. 하위 `demo/` 폴더는 시연용으로 별도 추가된 사진 세트이며 `demo/README.md`를 따른다.

- 정상 흐름(IT-01~10): 티링크가 쓰이는 업무 현장 사진(사무실 전화, 콜센터, 외근 차량, 병원 접수, 회의실)
- 무관 사진 처리(IT-19): 음식 사진, 풍경 사진
- 카드뉴스 배치(IT-20, B-01): 세로 사진 2장, 밝은 사진 2장, 어두운 사진 1장
- 업로드 거부(IT-12): 확장자만 바꾼 텍스트 파일(`fake-image.jpg`), 8MB 초과 파일(커밋하지 않음, 4절의 명령으로 생성)

## 2. 파일 목록

- 해상도·용량·형식: 내려받은 파일의 바이트를 직접 읽어 실측했다. 8장 모두 매직바이트가 `FF D8 FF E0`인 JPEG(JFIF)다.
- 밝기: Unsplash 이미지 CDN(imgix)의 `palette=json`이 돌려주는 `average_luminance`(0~1, 400px 축소본 기준) 값. 0.6 이상은 "밝음", 0.3 미만은 "어두움", 그 사이는 "보통"으로 적었다.
- 개인정보 확인: 커밋한 파일을 Read 도구로 직접 열어 눈으로 확인했다. 모니터·번호판·게시물처럼 작게 보이는 부분은 원본 해상도에서 해당 영역을 잘라(imgix `rect`) 확대해 다시 확인했다.
- 라이선스: 8장 모두 원본 페이지에서 "Free to use under the Unsplash License"(Unsplash+ 아님)를 확인했다. [Unsplash License](https://unsplash.com/license)는 상업적 이용을 포함해 무료로 쓸 수 있고 출처 표기는 의무가 아니지만, 확인을 위해 아래에 적어 둔다.

| 파일명 | 장면 | 방향 | 밝기 | 해상도·용량 | 개인정보 확인 결과 | EXIF/GPS | 출처 URL · 작가 · 라이선스 | 주로 쓰는 시험 ID |
|---|---|---|---|---|---|---|---|---|
| `office-desk-phone.jpg` | 사무실 책상 위 IP 데스크폰, 뒤로 흐린 사무실 | 가로 | 보통(0.46) | 1600×1067, 163,698B(160KB) | 인물 없음. 오른쪽 모니터 화면과 배경은 초점 밖이라 글자 판독 불가(원본 확대 확인). 전화기 액정에 정보 없음 | 없음(원래 없음) | https://unsplash.com/photos/black-ip-desk-phone-on-black-wooden-table-Dkn8-zPIbwo · Julian Hochgesang · Unsplash License | IT-01~10, IT-20 |
| `callcenter-headset.jpg` | 상담용 마이크 헤드셋과 노트북(콜센터·상담석) | 가로 | 밝음(0.63) | 1600×1067, 108,413B(106KB) | 인물 없음. 노트북 화면 꺼짐. 배경 벽의 그림·스티커는 흐려서 글자 판독 불가(원본 확대 확인) | 없음(원래 없음) | https://unsplash.com/photos/black-and-brown-headset-near-laptop-computer-BeVGrXEktIk · Petr Macháček · Unsplash License | IT-01~10(기본 시연 사진 후보), IT-20 |
| `sales-car-phone-vertical.jpg` | 운전 중 거치대 휴대폰(외근 영업·이동 중) | **세로** | 보통(0.50) | 1200×1800, 145,497B(142KB) | 운전자 손만 보이고 얼굴 없음. 휴대폰 화면은 내비게이션(공공 도로명 Montebello, Rte 323 등)으로 개인정보 없음. 앞차는 완전히 흐려 번호판 판독 불가(원본 확대 확인) | 없음(원래 없음) | https://unsplash.com/photos/a-person-holding-a-cell-phone-while-driving-a-car-oKWHvYlKNKk · capnsnap · Unsplash License | IT-08, IT-20(세로 사진 배치) |
| `clinic-reception.jpg` | 병원 1층 접수창구와 안내판 | 가로 | 밝음(0.69) | 1600×1089, 208,298B(203KB) | 접수창 안쪽에 사람 **정수리(머리카락) 일부만** 보이고 얼굴 없음(원본 확대 확인). 유리에 병원명 로고(기관명), 스페인어 층 안내판이 있으나 개인정보 아님. 서류 글자 판독 불가 | 없음(원래 없음) | https://unsplash.com/photos/hospital-lobby-reception-with-signage-nMyM7fxpokE · Martha Dominguez de Gouveia · Unsplash License | IT-08(타깃 "병의원"), IT-20(밝은 사진) |
| `meeting-room.jpg` | 빈 회의실(긴 테이블, 의자, 통유리창) | 가로 | 보통(0.54), 창이 밝은 역광 | 1600×1067, 248,921B(243KB) | 인물 없음. 테이블 위 모니터 화면은 비어 있음(원본 확대 확인) | 없음(원래 없음) | https://unsplash.com/photos/oval-brown-wooden-conference-table-and-chairs-inside-conference-room-GWe0dlVD9e0 · Benjamin Child · Unsplash License | IT-14(티링크 외 제품, 예: 회의실 예약 SaaS), IT-08 |
| `unrelated-food.jpg` | 금속 볼에 담긴 아보카도(제품과 무관) | 가로 | 보통(0.51), 채도 높음 | 1600×1312, 282,840B(276KB) | 인물·글자 없음 | 없음(원래 없음) | https://unsplash.com/photos/a-bowl-of-food-P29o02vb01I · Stepanenco Valeria · Unsplash License | **IT-19** |
| `dark-office-night.jpg` | 밤 사무 책상(노트북, 스탠드 조명, 창밖 야경) | 가로 | **어두움(0.10)** | 1600×1067, 141,602B(138KB) | 인물 없음. 노트북 화면 꺼짐("MacBook Pro" 제품명만 보임). 창밖 야경은 흐림 | 없음(원래 없음) | https://unsplash.com/photos/nighttime-desk-setup-with-laptop-lamp-and-city-view-odyglVvZv18 · Avtar Singh · Unsplash License | IT-20(어두운 사진 위 글자 가독성), B-01 |
| `unrelated-landscape-vertical.jpg` | 산과 호수 풍경(제품과 무관) | **세로** | 보통(0.53) | 1200×1600, 401,461B(392KB) | 먼 호숫가에 사람으로 보이는 아주 작은 점 몇 개만 있어 식별 불가. 글자 없음 | 없음(원래 없음) | https://unsplash.com/photos/calm-body-of-water-surrounded-with-trees-and-mountain-hsX9KpLLsIE · Ales Krivec · Unsplash License | **IT-19**, IT-20(세로) |
| `fake-image.jpg` | 확장자만 `.jpg`인 텍스트 파일(위장 파일) | - | - | 228B | 해당 없음(직접 작성한 안내 문구) | 해당 없음(JPEG 아님) | 직접 작성 | **IT-12** |

공통 확인 사항:
- **EXIF/GPS 실측(2026-11-20)**: Node로 JPEG 마커를 SOS 직전까지 순회해 메타데이터 세그먼트를 모두 나열했다. 8장 모두 `APP0(JFIF)`, `APP2(ICC_PROFILE)`, 양자화·허프만 테이블(`DQT`·`DHT`), `SOF2`만 있다.
  - `APP1`(Exif·XMP), `APP13`(IPTC·Photoshop), `COM`(주석) 세그먼트가 **없다**. 따라서 GPS IFD(태그 0x8825), 작성자(Artist 0x013B, Copyright 0x8298), 카메라 일련번호(BodySerialNumber 0xA431), 카메라 소유자(0xA430), 제조사·모델 정보가 들어갈 자리가 없다.
  - `APP2`는 8장 모두 같은 표준 sRGB 색 프로필("IEC sRGB", HP/Microsoft, 3,160B)이며 촬영자나 장소 정보가 아니다.
  - 제거할 메타데이터가 없어 **재인코딩하지 않았다.** 위 표의 해상도와 용량이 커밋된 파일 그대로다.
  - 검사기 검증: Artist와 GPS 포인터를 넣은 APP1(Exif) 합성 JPEG를 같은 검사기에 넣어 "Exif 있음, GPS 있음, Artist 있음"으로 잡히는 것을 확인했다(양성 대조군).
  - Unsplash CDN(`images.unsplash.com`)의 변환본은 원본 EXIF를 싣지 않는다. 다시 내려받을 때도 2.2절 주소(변환본)를 쓰고, `unsplash.com/photos/<ID>/download`의 원본 파일은 쓰지 않는다(원본 파일의 EXIF 포함 여부는 확인하지 않음).
- 상표·제품명(전화기, MacBook 등)은 사진 속 사물일 뿐 개인정보가 아니다. 카드뉴스나 홍보 문구에 이 상표를 쓰지 않도록 시험 결과를 볼 때 확인한다.

### 2.1 시험 용도별 빠른 선택

| 확인할 것 | 사용할 파일 |
|---|---|
| 기본 시연(완료기준 1~10) | `callcenter-headset.jpg` 또는 `office-desk-phone.jpg` |
| 세로 사진의 `object-fit: cover` 배치 | `sales-car-phone-vertical.jpg`, `unrelated-landscape-vertical.jpg` |
| 밝은 사진 위 글자 대비 | `clinic-reception.jpg`, `callcenter-headset.jpg` |
| 어두운 사진 위 글자 대비 | `dark-office-night.jpg` |
| 무관 사진에서 상황을 지어내지 않는지 | `unrelated-food.jpg`, `unrelated-landscape-vertical.jpg` |
| 업로드 거부 | `fake-image.jpg`, 4절에서 만든 8MB 초과 파일 |

### 2.2 다시 내려받는 방법(재현용)

모든 사진은 `https://unsplash.com/photos/<사진ID>/download?force=true`가 리다이렉트하는 CDN 주소(`dl=<작가>-<사진ID>-unsplash.jpg` 포함)로 사진 ID와 작가를 대조한 뒤, 같은 CDN 주소에 해상도 파라미터를 붙여 받았다.

| 파일명 | CDN 주소(파라미터 `?ixlib=rb-4.1.0&q=80&fm=jpg&cs=srgb&w=<폭>`) | 폭 |
|---|---|---|
| `office-desk-phone.jpg` | `https://images.unsplash.com/photo-1587560699334-bea93391dcef` | 1600 |
| `callcenter-headset.jpg` | `https://images.unsplash.com/photo-1553775282-20af80779df7` | 1600 |
| `sales-car-phone-vertical.jpg` | `https://images.unsplash.com/photo-1562993610-121a6b465200` | 1200 |
| `clinic-reception.jpg` | `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d` | 1600 |
| `meeting-room.jpg` | `https://images.unsplash.com/photo-1431540015161-0bf868a2d407` | 1600 |
| `unrelated-food.jpg` | `https://images.unsplash.com/photo-1661182260393-a3918d4e8571` | 1600 |
| `dark-office-night.jpg` | `https://images.unsplash.com/photo-1779444480590-9bf6f021d5d4` | 1600 |
| `unrelated-landscape-vertical.jpg` | `https://images.unsplash.com/photo-1435732960391-11053ee5e6b6` | 1200 |

## 3. 위장 파일 `fake-image.jpg`

- 내용: "이미지가 아니다"라는 한글·영문 안내 문장 두 줄(UTF-8 텍스트, 228바이트). 앞 바이트가 `EC 9D B4 …`(한글 "이"의 UTF-8)라서 JPEG 매직바이트 `FF D8 FF`가 아니다.
- 기대 결과: 브라우저는 확장자 때문에 `image/jpeg`로 보내지만 서버의 매직바이트 검사(`studio/src/lib/image.ts`)에서 거부된다. → HTTP 400 `INVALID_IMAGE`, "이미지 파일 내용을 확인할 수 없습니다. JPG, PNG, WebP 사진인지 확인해 주세요."(5절 실측)

## 4. 8MB 초과 파일 만들기 (커밋 금지)

8MB 초과 파일은 저장소에 넣지 않는다. 시험할 때 아래 명령 중 하나로 `studio/test-assets/`(또는 임시 폴더)에서 만든다. 이 폴더의 `.gitignore`가 `large-*` 파일을 커밋 대상에서 뺀다.

**(1) PowerShell — 9MB, JPEG 헤더만 있는 파일**
```powershell
$b = New-Object byte[] (9MB); $b[0]=0xFF; $b[1]=0xD8; $b[2]=0xFF; $b[3]=0xE0; [IO.File]::WriteAllBytes("$PWD\large-9mb.jpg", $b)
```

**(2) Node — 같은 파일**
```bash
node -e "const b=Buffer.alloc(9*1024*1024);b.set([0xFF,0xD8,0xFF,0xE0]);require('fs').writeFileSync('large-9mb.jpg',b)"
```

**(3) 실제 사진으로 8MB 초과 — `office-desk-phone.jpg`와 같은 사진의 원본 해상도·최고 화질**
```bash
curl -o large-real-photo.jpg "https://images.unsplash.com/photo-1587560699334-bea93391dcef?fm=jpg&q=100&w=6000"
```

- (1)(2)는 9,437,184바이트(9.00MB), 앞 4바이트가 `FF D8 FF E0`이다. JPEG 매직바이트를 넣었으므로 형식 검사가 아니라 **크기 검사**로 거부되는지 확인할 수 있다. (1)과 (2) 모두 2026-11-20에 실행해 크기와 헤더를 확인했다.
- (3)은 2026-11-20에 받았을 때 6000×4000, 9,526,103바이트(9.09MB)였다. CDN 인코딩이 바뀌면 크기가 달라질 수 있으니 받은 뒤 8MB(8,388,608바이트)를 넘는지 확인한다.
- 기대 결과: HTTP 413 `IMAGE_TOO_LARGE`(5절 실측). 화면에서는 클라이언트 검사(`checkImage`, 서버와 공용)에서 먼저 거부 메시지가 나와야 한다 — 브라우저 확인은 B-05에서 한다(이 과업에서는 미확인).

## 5. 업로드 확인 결과 (실측)

- 일시: 2026-11-20
- 환경: worktree `feature/b-test-assets`(origin/main c0cdd5d 기준), `studio/`에서 `npm run dev -- -p 3102`, Windows 11, Node v26.13.1
- 호출: Node `fetch` + `FormData`로 `POST /api/generate`. 제품명 "티링크 비즈레코딩", 제품 정보 3줄, 타깃 "콜센터·고객센터", `modelId` 없음(기본 모델: `config/ai-models.json`의 `gemini-3.8-flash`)

| 파일 | HTTP | 소요 | 결과 |
|---|---|---|---|
| `fake-image.jpg` | 400 | 8.9초(dev 첫 컴파일 포함) | `INVALID_IMAGE` "이미지 파일 내용을 확인할 수 없습니다. JPG, PNG, WebP 사진인지 확인해 주세요." |
| `large-9mb.jpg`(4절 명령 (2)) | 413 | 0.3초 | `IMAGE_TOO_LARGE` "요청 크기가 너무 큽니다(9.00MB). 사진은 최대 8MB까지 올릴 수 있습니다." |
| `large-real-photo.jpg`(4절 명령 (3), 9.09MB) | 413 | 0.2초 | `IMAGE_TOO_LARGE` "요청 크기가 너무 큽니다(9.09MB). …" |
| `callcenter-headset.jpg` | 200 | 23.3초 | 업로드 받아들여지고 생성 성공. `sceneAnalysis`: "나무 재질의 책상 위에 마이크가 달린 검은색 헤드셋이 놓여 있고, 그 뒤편 좌측에 화면이 열려 있는 노트북이 보입니다. …" |
| `unrelated-food.jpg` | 200 | 35.1초 | 업로드 받아들여지고 생성 성공. `sceneAnalysis`: "스테인리스 재질로 보이는 금속 볼 안에 씨가 제거되고 반으로 잘린 아보카도 조각들이 담겨 있습니다. …" (사진 묘사가 실제 장면과 일치) |

> 위 결과는 업로드 수용·거부 확인용이다. IT-19 등 생성 결과의 최종 합격 판정은 B-05 통합시험에서 결과물 전체를 보고 시험결과서에 기록한다.
> 나머지 6장(`office-desk-phone`, `sales-car-phone-vertical`, `clinic-reception`, `meeting-room`, `dark-office-night`, `unrelated-landscape-vertical`)은 API로 업로드하지 않았다. 형식(JPEG 매직바이트)과 크기(8MB 미만)는 실측으로 확인했다.

## 6. 검토했지만 쓰지 않은 후보

| 후보(Unsplash 사진 ID) | 제외 이유 |
|---|---|
| `kN_kViDchA0`(개방형 사무실), `WEDDt-u3q3o`(통화하는 사람), `GA08HdGHdWE`(운전 중 휴대폰) | 얼굴이 식별된다 |
| `jRhiHiVOyfU`·`ozzHH3KpUlw`(데스크폰 단독) | 개인정보 문제는 없으나 사무실 맥락이 약해 `Dkn8-zPIbwo`로 대체 |
| `DzEXtChh-Bw`(운전자 뒷모습) | 옆얼굴 일부(귀·안경·뺨)가 보여 보수적으로 제외 |
| `27zLImvxwV0`(접수대, 세로) | 확대해 보니 실제 시설의 QR코드·Wi-Fi 이름과 "촬영·녹음 금지" 게시물이 보여 제외 |
| `rJmJswpayvs`(운전 중 손에 든 휴대폰) | 운전 중 휴대폰을 손에 든 장면이라 홍보 소재로 부적절. 거치대 사진으로 대체 |
| Getty Images 등 "Unsplash+" 표시 사진 | 무료 Unsplash License가 아님 |
