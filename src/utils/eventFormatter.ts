export function formatEventLabel(e?: {
  puzzleTypeName?: string;
  puzzleTypeCode?: string;
  eventFormatCode?: string;
  medleyPuzzles?: { puzzleTypeName?: string; puzzleTypeCode?: string }[];
} | null): string {
  if (!e) return 'Môn thi';
  const isMedley = (e.eventFormatCode || '').toUpperCase() === 'MEDLEY';
  const baseName = e.puzzleTypeName || e.puzzleTypeCode || 'Rubik';

  if (isMedley) {
    if (e.medleyPuzzles && e.medleyPuzzles.length > 0) {
      const subNames = e.medleyPuzzles
        .map((mp) => mp.puzzleTypeName || mp.puzzleTypeCode)
        .filter(Boolean)
        .join(' + ');
      return `Medley Relay (${subNames})`;
    }
    return 'Medley Relay';
  }

  return baseName;
}
