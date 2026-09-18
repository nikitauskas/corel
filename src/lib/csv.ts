export interface CsvRow {
  'app6d type'?: string;
  'app6d sidc'?: string;
  'objects count'?: string;
  name?: string;
  'coordinates(mgrs)'?: string;
  'object creator'?: string;
}

export function parseCSV<T = CsvRow>(csvContent: string): T[] {
  const lines: string[] = [];
  let inQuotes = false;
  let currentLine = '';

  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r' && !inQuotes) {
      // skip
    } else {
      currentLine += char;
    }
  }
  if (currentLine) lines.push(currentLine);

  const result: T[] = [];
  if (lines.length === 0) return result;

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const lineStr = lines[i].trim();
    if (!lineStr) continue;
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? '';
    });
    result.push(obj as unknown as T);
  }

  return result;
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"'; // escaped quote
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentValue);
      currentValue = '';
    } else if (char === '\r' && !inQuotes) {
      // skip
    } else if (char === '\n' && !inQuotes) {
      // skip or keep? usually handled by outer split, but if trailing
    } else {
      currentValue += char;
    }
  }
  result.push(currentValue);
  return result;
}
