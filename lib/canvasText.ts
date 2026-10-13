/** Wrap full labels, including long unbroken names, without discarding characters. */
export function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && ctx.measureText(`${line} ${word}`).width <= width) {
        line += ` ${word}`;
        continue;
      }
      if (line) { lines.push(line); line = ''; }
      for (const character of word) {
        if (line && ctx.measureText(line + character).width > width) {
          lines.push(line); line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draw complete text within an existing graphic's label box. */
export function drawFullCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, baseline: number, width: number, height = 28) {
  ctx.save();
  const originalFont = ctx.font;
  const originalSize = Number(originalFont.match(/([\d.]+)px/)?.[1] || 12);
  let size = originalSize;
  let lines: string[];
  while (true) {
    ctx.font = originalFont.replace(/[\d.]+px/, `${size}px`);
    lines = wrapCanvasText(ctx, text, width);
    if (lines.length * size * 1.15 <= height || size <= 0.5) break;
    size *= 0.9;
  }
  const top = baseline - height * 0.65;
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => ctx.fillText(line, x, top + index * size * 1.15, width));
  ctx.restore();
}
