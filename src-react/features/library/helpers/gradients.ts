/** Gradient palette for imageless thumbnails (ports src/shared/ui/gradients.ts). */
const GRADS = [
  'linear-gradient(135deg,#3a2d6b,#c2456b)',
  'linear-gradient(135deg,#1f6b52,#2b3b4d)',
  'linear-gradient(135deg,#6b1f4d,#3a2233)',
  'linear-gradient(135deg,#46307a,#a84a6b)',
  'linear-gradient(135deg,#1f4d6b,#33335a)',
];

/** Stable per-id gradient (h*31 hash over the palette). */
export function gradFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return GRADS[h % GRADS.length];
}
