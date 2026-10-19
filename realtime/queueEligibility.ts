export interface QueueEligibilityEntry {
  id: string;
  competitorId: string;
}

export interface ActiveQueueProfile {
  competitorId: string;
  username: string;
}

/**
 * Queue rows are durable, socket ownership is not. Only rows backed by this
 * process's current connected socket and an ACTIVE account profile may pair.
 */
export function partitionEligibleQueueEntries<T extends QueueEligibilityEntry>(
  entries: readonly T[],
  onlineCompetitorIds: ReadonlySet<string>,
  activeProfiles: readonly ActiveQueueProfile[],
): { eligible: T[]; staleIds: string[]; usernames: Map<string, string> } {
  const usernames = new Map(activeProfiles.map((profile) => [profile.competitorId, profile.username]));
  const eligible: T[] = [];
  const staleIds: string[] = [];

  for (const entry of entries) {
    if (onlineCompetitorIds.has(entry.competitorId) && usernames.has(entry.competitorId)) {
      eligible.push(entry);
    } else {
      staleIds.push(entry.id);
    }
  }

  return { eligible, staleIds, usernames };
}
