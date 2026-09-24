export enum IdentificationStatus {
  Friend = 'FRIEND',
  AssumedFriend = 'ASSUMED_FRIEND',
  Hostile = 'HOSTILE',
  Suspect = 'SUSPECT',
  Neutral = 'NEUTRAL',
  Unknown = 'UNKNOWN',
  Pending = 'PENDING',
}

const UK_IDENTITY_MAP: Record<string, IdentificationStatus> = {
  дружні: IdentificationStatus.Friend,
  'очікувано дружні': IdentificationStatus.AssumedFriend,
  ворожі: IdentificationStatus.Hostile,
  підозрілі: IdentificationStatus.Suspect,
  нейтральні: IdentificationStatus.Neutral,
  невідомі: IdentificationStatus.Unknown,
  невизначені: IdentificationStatus.Pending,
};

export enum CombatEffectiveness {
  FullyCapable = 'FULLY_COMBAT_CAPABLE',
  PartiallyCapable = 'PARTIALLY_COMBAT_CAPABLE',
  NotCapable = 'NOT_COMBAT_CAPABLE',
  RestoredToFullCapability = 'RESTORED_TO_FULL_CAPABILITY',
}

const UK_EFFECTIVENESS_MAP: Record<string, CombatEffectiveness> = {
  'повністю боєздатні': CombatEffectiveness.FullyCapable,
  'частково боєздатні': CombatEffectiveness.PartiallyCapable,
  небоєздатні: CombatEffectiveness.NotCapable,
  'відновлений до повної боєздатності':
    CombatEffectiveness.RestoredToFullCapability,
  // Можлива варіація в множині
  'відновлені до повної боєздатності':
    CombatEffectiveness.RestoredToFullCapability,
};

/**
 * Нормалізує пробіли та регістр і повертає значення CombatEffectiveness
 */
export function parseCombatEffectiveness(
  input: string,
): CombatEffectiveness | null {
  const normalized = input.trim().toLowerCase().replaceAll(/\s+/g, ' ');

  return UK_EFFECTIVENESS_MAP[normalized] ?? null;
}

/**
 * Normalizes whitespace/newlines, converts to lowercase, and maps to StandardIdentity.
 */
export function parseStandardIdentity(
  input: string,
): IdentificationStatus | null {
  const normalized = input.trim().toLowerCase().replaceAll(/\s+/g, ' ');

  return UK_IDENTITY_MAP[normalized] ?? null;
}
