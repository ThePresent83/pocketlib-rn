import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { Platform } from 'react-native';

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  uri: string;
  html: string;
  text: string;
}

export interface EpubBook {
  title: string;
  author: string;
  chapters: EpubChapter[];
  rootUri: string;
  fixedLayout: boolean;
}

interface LoadEpubOptions {
  includeText?: boolean;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

const epubCache = new Map<string, Promise<EpubBook>>();

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
});

const CP1251_EXTRA_CODES = [
  0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021,
  0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
  0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x0098, 0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f,
  0x00a0, 0x040e, 0x045e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7,
  0x0401, 0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407,
  0x00b0, 0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7,
  0x0451, 0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
];

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx + 1) : '';
}

function joinPath(baseDir: string, href: string): string {
  if (/^(https?:|data:|mailto:|#)/i.test(href)) return href;
  return normalizePath(`${baseDir}${href.split('#')[0]}`);
}

function detectDeclaredEncoding(bytes: Uint8Array): string {
  const head = Array.from(bytes.slice(0, 2048))
    .map(byte => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ' '))
    .join('');
  const match = head.match(/(?:encoding|charset)\s*=\s*["']?\s*([a-zA-Z0-9._-]+)/i);
  return match?.[1]?.toLowerCase() || '';
}

function decodeWindows1251(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) {
    if (byte < 0x80) {
      output += String.fromCharCode(byte);
    } else if (byte < 0xc0) {
      output += String.fromCodePoint(CP1251_EXTRA_CODES[byte - 0x80]);
    } else {
      output += String.fromCodePoint(0x0410 + byte - 0xc0);
    }
  }
  return output;
}

function decodeUtf8(bytes: Uint8Array): string | null {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  return null;
}

function decodeZipText(bytes: Uint8Array, utf8Fallback: string | null = null): string {
  const declaredEncoding = detectDeclaredEncoding(bytes);
  if (/^(windows-1251|cp1251|x-cp1251)$/i.test(declaredEncoding)) {
    return decodeWindows1251(bytes);
  }

  const utf8 = decodeUtf8(bytes) ?? utf8Fallback ?? '';
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replacementCount > Math.max(3, utf8.length * 0.01)) {
    return decodeWindows1251(bytes);
  }
  return utf8;
}

async function readZipText(entry: any): Promise<string> {
  const bytes = await entry.async('uint8array');
  const fallback = typeof TextDecoder === 'undefined' ? await entry.async('string') : null;
  return decodeZipText(bytes, fallback);
}

function getTextValue(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  return String(value);
}

function getMetadataMetaValue(metadata: any, property: string): string {
  for (const item of asArray(metadata?.meta)) {
    if (item?.property === property || item?.name === property) {
      return getTextValue(item);
    }
  }
  return '';
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    copy: '(c)',
    gt: '>',
    laquo: '"',
    ldquo: '"',
    lsquo: "'",
    lt: '<',
    mdash: '-',
    ndash: '-',
    nbsp: ' ',
    quot: '"',
    raquo: '"',
    rdquo: '"',
    rsquo: "'",
    shy: '',
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity] ?? ' ';
  });
}

function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|math|object|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|aside|blockquote|h[1-6]|li|tr|table)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractChapterTitle(html: string, fallback: string): string {
  const heading = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (heading?.[1]) {
    const text = stripHtmlToText(heading[1]);
    if (text) return text;
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) {
    const text = stripHtmlToText(title[1]);
    if (text) return text;
  }

  return fallback;
}

function looksFixedLayout(html: string): boolean {
  return /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*(width\s*=\s*\d+)[^"']*(height\s*=\s*\d+)/i.test(html)
    || /<body[^>]+style=["'][^"']*width\s*:\s*\d+px[^"']*height\s*:\s*\d+px/i.test(html)
    || /position\s*:\s*absolute/i.test(html)
    || (/left\s*:\s*-?\d+(?:\.\d+)?px/i.test(html) && /top\s*:\s*-?\d+(?:\.\d+)?px/i.test(html));
}

function findManifestItem(manifest: ManifestItem[], id: string): ManifestItem | undefined {
  return manifest.find(item => item.id === id);
}

function cacheKey(filePath: string): string {
  return filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-120);
}

function mimeForPath(filePath: string): string {
  const ext = filePath.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'xhtml' || ext === 'html' || ext === 'htm') return 'text/html';
  if (ext === 'css') return 'text/css';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'woff') return 'font/woff';
  if (ext === 'woff2') return 'font/woff2';
  if (ext === 'ttf') return 'font/ttf';
  return 'application/octet-stream';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteWebChapterHtml(html: string, chapterPath: string, assetUrls: Map<string, string>): string {
  const chapterDir = dirname(chapterPath);
  let rewritten = html;

  for (const [assetPath, assetUrl] of assetUrls.entries()) {
    const relativeFromChapter = normalizePath(assetPath.startsWith(chapterDir) ? assetPath.slice(chapterDir.length) : assetPath);
    const candidates = Array.from(new Set([
      assetPath,
      relativeFromChapter,
      assetPath.replace(/ /g, '%20'),
      relativeFromChapter.replace(/ /g, '%20'),
    ])).filter(Boolean);

    for (const candidate of candidates) {
      rewritten = rewritten.replace(new RegExp(escapeRegExp(candidate), 'g'), assetUrl);
    }
  }

  if (!/<base\s/i.test(rewritten)) {
    rewritten = rewritten.replace(/<head([^>]*)>/i, '<head$1><base target="_blank" />');
  }
  return rewritten;
}

async function loadZip(filePath: string): Promise<JSZip> {
  if (Platform.OS === 'web') {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`EPUB request failed: ${response.status}`);
    }
    return JSZip.loadAsync(await response.arrayBuffer());
  }

  const base64 = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
  return JSZip.loadAsync(base64, { base64: true });
}

async function createWebAssetUrls(zip: JSZip): Promise<Map<string, string>> {
  const urls = new Map<string, string>();

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const safePath = normalizePath(name);
    if (!safePath || safePath.startsWith('..')) continue;

    const blob = await entry.async('blob');
    urls.set(safePath, URL.createObjectURL(new Blob([blob], { type: mimeForPath(safePath) })));
  }

  return urls;
}

async function ensureDirectory(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function extractEpub(zip: JSZip, filePath: string): Promise<string> {
  const rootUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}epub/${cacheKey(filePath)}/`;
  const markerUri = `${rootUri}.extracted`;
  await ensureDirectory(rootUri);

  const marker = await FileSystem.getInfoAsync(markerUri);
  if (marker.exists) return rootUri;

  for (const [name, entry] of Object.entries(zip.files)) {
    const safePath = normalizePath(name);
    if (!safePath || safePath.startsWith('..')) continue;
    const targetUri = `${rootUri}${safePath}`;

    if (entry.dir) {
      await ensureDirectory(targetUri.endsWith('/') ? targetUri : `${targetUri}/`);
      continue;
    }

    await ensureDirectory(dirname(targetUri));
    const base64 = await entry.async('base64');
    await FileSystem.writeAsStringAsync(targetUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  }

  await FileSystem.writeAsStringAsync(markerUri, String(Date.now()));
  return rootUri;
}

async function loadEpubUncached(filePath: string, options: LoadEpubOptions = {}): Promise<EpubBook> {
  const includeText = options.includeText ?? false;
  const zip = await loadZip(filePath);
  const assetUrls = Platform.OS === 'web' ? await createWebAssetUrls(zip) : new Map<string, string>();
  const rootUri = Platform.OS === 'web' ? filePath : await extractEpub(zip, filePath);
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB container.xml not found');

  const container = xmlParser.parse(await readZipText(containerFile));
  const rootfile = asArray(container.container?.rootfiles?.rootfile)[0];
  const opfPath = rootfile?.['full-path'];
  if (!opfPath) throw new Error('EPUB OPF file not found');

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('EPUB OPF file is missing');

  const opfDir = dirname(opfPath);
  const opf = xmlParser.parse(await readZipText(opfFile));
  const pkg = opf.package;
  const metadata = pkg?.metadata || {};
  const manifestItems = asArray(pkg?.manifest?.item).map((item: any): ManifestItem => ({
    id: item.id,
    href: item.href,
    mediaType: item['media-type'] || item.mediaType || '',
  }));
  const spineItems = asArray(pkg?.spine?.itemref);
  const title = getTextValue(metadata['dc:title']) || 'EPUB';
  const author = getTextValue(metadata['dc:creator']);
  const renditionLayout = getMetadataMetaValue(metadata, 'rendition:layout')
    || getTextValue(metadata['rendition:layout']);

  const chapters: EpubChapter[] = [];
  let fixedLayout = /pre-paginated|fixed/i.test(renditionLayout);
  for (const [index, spineItem] of spineItems.entries()) {
    const idref = spineItem.idref;
    const manifestItem = findManifestItem(manifestItems, idref);
    if (!manifestItem || !/xhtml|html/i.test(manifestItem.mediaType)) continue;

    const chapterPath = joinPath(opfDir, manifestItem.href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;

    const shouldInspectLayout = !includeText && index < 8;
    const shouldReadHtml = includeText || Platform.OS === 'web' || shouldInspectLayout;
    const rawHtml = shouldReadHtml ? await readZipText(chapterFile) : '';
    const html = Platform.OS === 'web' && rawHtml ? rewriteWebChapterHtml(rawHtml, chapterPath, assetUrls) : rawHtml;
    if (html && looksFixedLayout(html)) {
      fixedLayout = true;
    }
    chapters.push({
      id: manifestItem.id,
      title: html ? extractChapterTitle(html, title) : `${title} ${index + 1}`,
      href: chapterPath,
      uri: Platform.OS === 'web' ? assetUrls.get(chapterPath) || filePath : `${rootUri}${chapterPath}`,
      html,
      text: html ? stripHtmlToText(html) : '',
    });
  }

  if (chapters.length === 0 || (includeText && chapters.every(chapter => !chapter.text))) {
    throw new Error(includeText ? 'EPUB readable chapters not found' : 'EPUB chapters not found');
  }

  return { title, author, chapters, rootUri, fixedLayout };
}

export function loadEpub(filePath: string, options: LoadEpubOptions = {}): Promise<EpubBook> {
  const cacheKey = `${filePath}:${options.includeText ? 'text' : 'visual'}`;
  const cached = epubCache.get(cacheKey);
  if (cached) return cached;

  const request = loadEpubUncached(filePath, options).catch((error) => {
    epubCache.delete(cacheKey);
    throw error;
  });
  epubCache.set(cacheKey, request);
  return request;
}
