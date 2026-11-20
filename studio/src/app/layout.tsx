import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 제안서 폰트(Noto Sans KR). next/font가 빌드 시 로컬 번들로 내려받아 같은 출처에서 제공하므로
// 카드뉴스 PNG 캡처 때 폰트를 임베드할 수 있다(PRD R3).
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "T-LINK Value Studio",
  description: "현장 사진과 제품 정보로 CEO 영업 사각지대를 분석하고 홍보 카드뉴스를 만듭니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
