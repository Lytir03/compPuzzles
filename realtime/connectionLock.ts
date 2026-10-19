const competitorChains = new Map<string, Promise<void>>();

/** Serializes this process's reconnect/disconnect state transitions per competitor. */
export function withCompetitorConnectionLock<T>(
  competitorId: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = competitorChains.get(competitorId) ?? Promise.resolve();
  const result = previous.then(work, work);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  competitorChains.set(competitorId, tail);
  void tail.then(() => {
    if (competitorChains.get(competitorId) === tail) competitorChains.delete(competitorId);
  });
  return result;
}
