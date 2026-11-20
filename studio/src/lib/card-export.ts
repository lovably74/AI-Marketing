// 카드뉴스 PNG 내보내기 (브라우저 전용, FR-OUT-06)
// html-to-image는 문서의 모든 @font-face를 임베드하려 해서 한글 폰트(수십~수백 개 unicode-range 조각)에서
// 매우 느려질 수 있다. 카드에 실제로 쓰인 글자·굵기가 속한 조각만 골라 base64로 임베드한 CSS를 직접 만든다.
import { toCanvas } from "html-to-image";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

/** 캡처 전체 제한 시간. 넘기면 멈춘 것으로 보고 사용자에게 오류를 안내한다. */
const CAPTURE_TIMEOUT_MS = 30_000;

const dataUrlCache = new Map<string, Promise<string>>();

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fetchAsDataUrl(url: string): Promise<string> {
  let p = dataUrlCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`폰트 파일을 불러오지 못했습니다(${res.status})`);
        return res.blob();
      })
      .then(blobToDataUrl);
    dataUrlCache.set(url, p);
    p.catch(() => dataUrlCache.delete(url));
  }
  return p;
}

/** "U+AC00-D7A3, U+4??" 형식을 [시작, 끝] 목록으로 바꾼다 */
export function parseUnicodeRange(value: string): [number, number][] {
  return value
    .split(",")
    .map((s) => s.trim().replace(/^u\+/i, ""))
    .filter(Boolean)
    .map((part): [number, number] => {
      if (part.includes("?")) {
        return [parseInt(part.replace(/\?/g, "0"), 16), parseInt(part.replace(/\?/g, "F"), 16)];
      }
      const [a, b] = part.split("-");
      const start = parseInt(a, 16);
      return [start, b ? parseInt(b, 16) : start];
    })
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
}

const normalizeFamily = (f: string) => f.trim().replace(/["']/g, "").toLowerCase();

function toWeight(v: string): number {
  if (v === "normal") return 400;
  if (v === "bold") return 700;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 400;
}

/** @font-face의 font-weight 설명자("400", "100 900", "bold")가 쓰인 굵기 중 하나를 포함하는지 */
export function weightMatches(descriptor: string, used: ReadonlySet<number>): boolean {
  const parts = descriptor.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  const lo = toWeight(parts[0]);
  const hi = parts.length > 1 ? toWeight(parts[1]) : lo;
  for (const w of used) if (w >= lo && w <= hi) return true;
  return false;
}

interface CardTypography {
  families: Set<string>;
  weights: Set<number>;
  /** 계산된 font-family 목록 원문(첫 번째가 실제 웹폰트) */
  fontFamilyList: string;
}

function collectTypography(root: HTMLElement): CardTypography {
  const families = new Set<string>();
  const weights = new Set<number>();
  const visit = (el: Element) => {
    const cs = getComputedStyle(el);
    cs.fontFamily.split(",").forEach((f) => families.add(normalizeFamily(f)));
    // 글자가 직접 들어 있는 요소의 굵기만 모은다
    if (Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) {
      weights.add(toWeight(cs.fontWeight));
    }
    Array.from(el.children).forEach(visit);
  };
  visit(root);
  return { families, weights, fontFamilyList: getComputedStyle(root).fontFamily };
}

/**
 * 카드에 쓰인 글자·굵기마다 웹폰트 조각을 명시적으로 내려받고 끝날 때까지 기다린다.
 * document.fonts.ready만으로는 아직 요청되지 않은 unicode-range 조각을 보장하지 못하므로 load()를 먼저 부른다.
 * 웹폰트를 하나도 찾지 못하면 기본 글꼴로 저장되는 것을 막기 위해 오류를 낸다.
 */
async function ensureFontsLoaded(root: HTMLElement, typo: CardTypography): Promise<void> {
  if (!document.fonts) return;
  const text = root.textContent ?? "";
  for (const w of typo.weights) {
    let faces: FontFace[];
    try {
      faces = await document.fonts.load(`${w} 40px ${typo.fontFamilyList}`, text);
    } catch {
      throw new Error("카드 글꼴(Noto Sans KR)을 내려받지 못했습니다. 네트워크 상태를 확인하고 페이지를 새로고침해 주세요.");
    }
    if (faces.length === 0) {
      throw new Error(`카드 글꼴(굵기 ${w})을 찾지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.`);
    }
  }
  await document.fonts.ready;
}

/** 카드에 쓰인 글꼴·굵기·글자에 해당하는 @font-face만 base64로 임베드한 CSS를 만든다 */
export async function buildFontEmbedCSS(root: HTMLElement, typo = collectTypography(root)): Promise<string> {
  const codepoints = new Set<number>();
  for (const ch of root.textContent ?? "") codepoints.add(ch.codePointAt(0)!);
  const cps = [...codepoints];

  const rules: { rule: CSSFontFaceRule; base: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue; // 다른 출처 스타일시트는 건너뛴다
    }
    for (const r of Array.from(cssRules)) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      const family = normalizeFamily(r.style.getPropertyValue("font-family"));
      if (!typo.families.has(family)) continue;
      if (!weightMatches(r.style.getPropertyValue("font-weight"), typo.weights)) continue;
      const range = r.style.getPropertyValue("unicode-range");
      if (range) {
        const ranges = parseUnicodeRange(range);
        if (!cps.some((cp) => ranges.some(([a, b]) => cp >= a && cp <= b))) continue;
      }
      rules.push({ rule: r, base: sheet.href ?? location.href });
    }
  }

  const css = await Promise.all(
    rules.map(async ({ rule, base }) => {
      let text = rule.cssText;
      const urls = [...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
      for (const u of urls) {
        if (u.startsWith("data:")) continue;
        const dataUrl = await fetchAsDataUrl(new URL(u, base).href);
        text = text.split(u).join(dataUrl);
      }
      return text;
    }),
  );
  return css.join("\n");
}

/**
 * 카드 안 사진의 디코딩이 끝날 때까지 기다린다.
 * 사진은 업로드 시 FileReader로 만든 dataURL을 그대로 쓰므로 캡처 SVG 안에서 외부 요청이 생기지 않는다.
 * (dataURL이 아닌 경우에도 html-to-image가 복제본에서 dataURL로 임베드한다)
 */
async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.decode().catch(() => {
        if (!img.complete || img.naturalWidth === 0) throw new Error("사진을 불러오지 못했습니다.");
      }),
    ),
  );
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG로 변환하지 못했습니다."))), "image/png");
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`PNG 생성이 ${ms / 1000}초 안에 끝나지 않았습니다.`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function capture(node: HTMLElement): Promise<Blob> {
  const typo = collectTypography(node);
  await ensureFontsLoaded(node, typo);
  await waitForImages(node);
  const fontEmbedCSS = await buildFontEmbedCSS(node, typo);
  const canvas = await toCanvas(node, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    canvasWidth: CARD_WIDTH,
    canvasHeight: CARD_HEIGHT,
    pixelRatio: 1, // 기기 배율과 무관하게 정확히 1080×1350
    skipAutoScale: true,
    fontEmbedCSS,
    backgroundColor: "#0B1736",
    cacheBust: false,
  });
  if (canvas.width !== CARD_WIDTH || canvas.height !== CARD_HEIGHT) {
    throw new Error(`이미지 크기가 ${canvas.width}×${canvas.height}로 만들어졌습니다(기대 ${CARD_WIDTH}×${CARD_HEIGHT}).`);
  }
  return canvasToPngBlob(canvas);
}

/**
 * 화면 밖에 그린 1080×1350 원본 카드 노드를 PNG로 캡처한다.
 * (화면의 축소 미리보기는 transform이 걸려 있으므로 캡처하지 않는다)
 */
export function captureCardPng(node: HTMLElement): Promise<Blob> {
  return withTimeout(capture(node), CAPTURE_TIMEOUT_MS);
}

/** Blob을 파일로 내려받게 한다(긴 dataURL 대신 object URL을 써서 브라우저 길이 제한을 피한다) */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 다운로드가 시작될 시간을 준 뒤 해제한다
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
