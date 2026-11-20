import { EXPERIENCE_PATH, OFFICIAL_REPORT_URL } from "./constants";

export interface CampaignQr {
  url: string;
  imageSrc: string;
  goesToExperience: boolean;
}

export function getCardQrDestination(siteUrl?: string): Omit<CampaignQr, "imageSrc"> {
  if (siteUrl) {
    try {
      const site = new URL(siteUrl);
      const host = site.hostname.toLowerCase().replace(/\.$/, "");
      const local = host === "localhost" || host.endsWith(".localhost") ||
        host.startsWith("127.") || host === "[::1]" || host === "0.0.0.0";
      if (!local && !site.username && !site.password && ["https:", "http:"].includes(site.protocol)) {
        return { url: new URL(EXPERIENCE_PATH, site).href, goesToExperience: true };
      }
    } catch {
      // 공개 주소가 없거나 유효하지 않으면 공식 보고서를 안내한다.
    }
  }
  return { url: OFFICIAL_REPORT_URL, goesToExperience: false };
}
