// 내보내기 진입점 (서버 전용): 형식별 생성기 호출
import type { ExportRequest } from "../deliver-types";
import { buildDocx } from "./docx";
import { buildPdf } from "./pdf";
import { buildPptx } from "./pptx";
import { buildXlsx } from "./xlsx";
import { buildZip } from "./zip";

export { contentDisposition, exportFilename, MIME } from "./common";

export async function buildExport(req: ExportRequest, now = new Date()): Promise<Buffer> {
  switch (req.format) {
    case "pdf":
      return buildPdf(req);
    case "docx":
      return buildDocx(req.generation);
    case "pptx":
      return buildPptx(req.generation, req.cardPngDataUrl);
    case "xlsx":
      return buildXlsx(req.generation);
    case "zip":
      return buildZip(req, now);
  }
}
