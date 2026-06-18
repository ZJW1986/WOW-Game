const suspiciousCodePoints = [
  0xfffd,
  0x00c3,
  0x00c2,
  0x20ac,
  0x6d93,
  0x934b,
  0x9422,
  0x68f0,
  0x74a7,
  0x59af,
  0x6dee,
  0x95c2,
  0x97ec,
  0x97ac,
  0x6d63,
  0x939b,
  0x9352,
  0x7ecc,
  0x7efe,
  0x5bb8
];

const suspiciousFragments = suspiciousCodePoints.map((codePoint) => String.fromCharCode(codePoint));

export function containsMojibake(text: string): boolean {
  return suspiciousFragments.some((fragment) => text.includes(fragment));
}
