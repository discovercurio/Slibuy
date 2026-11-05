// Public, read-only source. No API key or sign-in is needed.
export const CONFIG = {
  sheetId: '1_wqWVF2aKz6cFcCUVI-Iro7cC7zhailawJb0n_1PpMw',
  sources: [
    { sheet: 'Factory Sealed Report', label: 'Factory sealed', condition: 'Factory Sealed' },
    { sheet: 'High MSRP - Appears New', label: 'High MSRP', condition: 'Appears New' }
  ],
  rawSheet: '_scan_buffer',
  useRawBuffer: true,
  timeoutMs: 18000,
  pollIntervalMs: 5 * 60 * 1000,
  pageSize: 24
};
