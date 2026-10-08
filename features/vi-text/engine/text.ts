// Text normalisation and font-run splitting.
import { FONT_PRICEDOWN, FONT_PRICEDOWN_SS01, type FontFamily } from "./config";

/** A character survives only if it is a letter, number, punctuation, symbol or a plain space. */
const RENDERABLE = /^[\p{L}\p{N}\p{P}\p{S} ]$/u;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

/** Uppercases a line, mapping ß / ẞ to whichever sharp-s the title font can draw. */
export function toTitleCase(line: string, sharpS: string): string {
  let out = "";
  for (const ch of line) out += ch === "ß" || ch === "ẞ" ? sharpS : ch.toUpperCase();
  return out;
}

/** Drops everything that cannot be rendered (emoji modifiers, control chars, tabs, ...). */
export function keepRenderable(line: string): string {
  let out = "";
  for (const ch of line) if (RENDERABLE.test(ch)) out += ch;
  return out;
}

/** Splits text into lines, uppercases and filters each one. */
export function toUpperLines(text: string, sharpS: string): string[] {
  return text.split("\n").map((line) => keepRenderable(toTitleCase(line, sharpS)));
}

/** Splits text into lines and filters each one, keeping case (script text). */
export function toRawLines(text: string): string[] {
  return text.split("\n").map(keepRenderable);
}

export interface FontRun {
  text: string;
  family: FontFamily;
}

/**
 * Splits a Pricedown line into runs. With interlock on, an R/r followed by a
 * letter or digit is drawn with the ss01 face, whose R tail hooks under the
 * next glyph.
 */
export function pricedownRuns(line: string, interlock: boolean): FontRun[] {
  if (!line) return [];
  if (!interlock) return [{ text: line, family: FONT_PRICEDOWN }];
  const chars = Array.from(line);
  const runs: FontRun[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    const family =
      (ch === "R" || ch === "r") && next !== undefined && LETTER_OR_NUMBER.test(next) ? FONT_PRICEDOWN_SS01 : FONT_PRICEDOWN;
    const last = runs[runs.length - 1];
    if (last && last.family === family) last.text += ch;
    else runs.push({ text: ch, family });
  }
  return runs;
}
