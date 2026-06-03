const fallbackColors = [
  '#d7ff2f',
  '#00c2ff',
  '#ff3b9d',
  '#ff5a3d',
  '#b985ff',
  '#fff36b',
  '#66ff8f',
  '#ff9f1c',
];

export const defaultTypeColors: Record<string, string> = {
  milestone: '#d7ff2f',
  meeting: '#00c2ff',
  decision: '#ff3b9d',
  incident: '#ff5a3d',
  review: '#b985ff',
  note: '#ffffff',
};

export function colorForType(type: string, typeColors: Record<string, string> = {}) {
  const cleanType = type.trim();
  if (!cleanType) return '#ffffff';
  if (typeColors[cleanType]) return typeColors[cleanType];
  if (defaultTypeColors[cleanType]) return defaultTypeColors[cleanType];

  const hash = [...cleanType].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackColors[hash % fallbackColors.length];
}

export function buildTypeColors(types: string[], existing: Record<string, string> = {}) {
  return types.reduce<Record<string, string>>((colors, type) => {
    const cleanType = type.trim();
    if (!cleanType) return colors;
    colors[cleanType] = colorForType(cleanType, existing);
    return colors;
  }, {});
}
