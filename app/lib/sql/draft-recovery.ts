export const MAX_DRAFT_LENGTH = 20_000;

type DraftValue = string | null;

export type DraftBackup = {
  base: DraftValue;
  value: DraftValue;
  writing?: DraftValue;
};

function isDraftValue(value: unknown): value is DraftValue {
  return value === null || (typeof value === "string" && value.length <= MAX_DRAFT_LENGTH);
}

export function parseDraftBackup(raw: string | null): DraftBackup | undefined {
  if (raw === null) return;
  try {
    const entry = JSON.parse(raw) as Partial<DraftBackup> | null;
    if (
      entry &&
      isDraftValue(entry.base) &&
      isDraftValue(entry.value) &&
      (entry.writing === undefined || isDraftValue(entry.writing))
    ) return entry as DraftBackup;
  } catch {
    // A corrupt recovery copy does not prevent the synced draft from loading.
  }
}

export function compareDraftBackup(backup: DraftBackup, saved: DraftValue) {
  if (backup.value === saved) return "saved";
  if (backup.base === saved || backup.writing === saved) return "recover";
  return "conflict";
}
