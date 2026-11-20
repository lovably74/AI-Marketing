// 전체 묶음 ZIP (서버 전용): PDF·Word·PPT·Excel + 카드뉴스 PNG + 블로그/SNS 텍스트
import JSZip from "jszip";
import type { GenerateSuccess } from "../api-types";
import type { ExportFormat, RecipientInfo } from "../deliver-types";
import { AI_NOTICE, CONTACT, decodeDataUrl, exportFilename, stamp, tag } from "./common";
import { buildDocx } from "./docx";
import { buildPdf } from "./pdf";
import { buildPptx } from "./pptx";
import { buildXlsx } from "./xlsx";

export interface ZipInput {
  generation: GenerateSuccess;
  recipient?: RecipientInfo;
  cardPngDataUrl?: string;
  photoDataUrl?: string;
}

const BOM = "﻿";

export async function buildZip(input: ZipInput, now = new Date()): Promise<Buffer> {
  const { result } = input.generation;
  const [pdf, docx, pptx, xlsx] = await Promise.all([
    buildPdf(input),
    buildDocx(input.generation),
    buildPptx(input.generation, input.cardPngDataUrl),
    buildXlsx(input.generation),
  ]);
  const zip = new JSZip();
  const add = (f: ExportFormat, buf: Buffer) => zip.file(exportFilename(f, now), buf);
  add("pdf", pdf);
  add("docx", docx);
  add("pptx", pptx);
  add("xlsx", xlsx);

  const card = decodeDataUrl(input.cardPngDataUrl);
  if (card) {
    const ext = card.mime === "image/png" ? "png" : card.mime === "image/jpeg" ? "jpg" : "webp";
    zip.file(`tlink-cardnews-${stamp(now)}.${ext}`, card.buffer);
  }

  const photo = decodeDataUrl(input.photoDataUrl);
  if (photo) {
    const ext = photo.mime === "image/png" ? "png" : photo.mime === "image/jpeg" ? "jpg" : "webp";
    zip.file(`tlink-photo-${stamp(now)}.${ext}`, photo.buffer);
  }

  const footer = `\n\n홈페이지: ${CONTACT.homepage}\n대표번호: ${CONTACT.phone}\n상담 페이지: ${CONTACT.center}\n\n※ ${AI_NOTICE}\n`;
  const hashtags = result.hashtags.map(tag).join(" ");
  zip.file(
    `tlink-blog-${stamp(now)}.txt`,
    `${BOM}${result.blogTitle}\n\n${result.blogContent}\n\n${hashtags}${footer}`.replace(/\r?\n/g, "\r\n"),
  );
  zip.file(
    `tlink-sns-${stamp(now)}.txt`,
    `${BOM}${result.snsContent}\n\n${result.cta}\n\n${hashtags}${footer}`.replace(/\r?\n/g, "\r\n"),
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
