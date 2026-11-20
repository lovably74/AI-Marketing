// 블로그 게시글 Word(.docx) (서버 전용)
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { GenerateSuccess } from "../api-types";
import { AI_NOTICE, BRAND, CONTACT, tag } from "./common";

const FONT = "맑은 고딕";
const hex = (c: string) => c.replace("#", "");

export async function buildDocx(generation: GenerateSuccess): Promise<Buffer> {
  const { result } = generation;
  const body = result.blogContent
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const placeholder = /^\[이미지:.*\]$/.test(line);
      return new Paragraph({
        spacing: { after: 200, line: 360 },
        alignment: placeholder ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: line,
            font: FONT,
            size: 22,
            italics: placeholder,
            color: placeholder ? "888888" : "222222",
          }),
        ],
      });
    });

  const doc = new Document({
    creator: "티링크 홍보 콘텐츠 생성기",
    title: result.blogTitle,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 300 },
            children: [new TextRun({ text: result.blogTitle, bold: true, size: 36, font: FONT, color: hex(BRAND.navy) })],
          }),
          ...body,
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({ text: result.hashtags.map(tag).join(" "), font: FONT, size: 20, color: hex(BRAND.blue) }),
            ],
          }),
          new Paragraph({
            border: { top: { style: "single", size: 6, color: hex(BRAND.orange), space: 8 } },
            spacing: { before: 200 },
            children: [new TextRun({ text: "문의", bold: true, font: FONT, size: 20, color: hex(BRAND.navy) })],
          }),
          new Paragraph({ children: [new TextRun({ text: `홈페이지: ${CONTACT.homepage}`, font: FONT, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `대표번호: ${CONTACT.phone}`, font: FONT, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `상담 페이지: ${CONTACT.center}`, font: FONT, size: 20 })] }),
          new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: AI_NOTICE, font: FONT, size: 16, color: "888888" })],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
