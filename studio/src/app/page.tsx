import { StudioApp } from "@/components/StudioApp";
import { getCardQrDestination } from "@/lib/campaign";
import QRCode from "qrcode";

async function createQrImage(url: string) {
  "use cache";
  return QRCode.toDataURL(url, { width: 208, margin: 4, errorCorrectionLevel: "M" });
}

export default async function Home() {
  const destination = getCardQrDestination(process.env.NEXT_PUBLIC_SITE_URL);
  const imageSrc = await createQrImage(destination.url);
  return <StudioApp campaignQr={{ ...destination, imageSrc }} />;
}
