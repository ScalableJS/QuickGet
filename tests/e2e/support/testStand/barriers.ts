/**
 * Named rendezvous points inside a transfer.
 *
 * A stall expressed as "sleep 5 seconds" is a wall-clock race: the test has to guess how long the
 * client needs to notice, and the guess is wrong on a loaded machine. A barrier inverts it — the
 * server sends exactly N bytes, announces that it got there, and sends nothing more until the test
 * says so. Both sides of the wait are events, so there is no duration to tune and nothing to flake.
 */
export class Barriers {
  private readonly reached = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  private readonly released = new Map<string, { promise: Promise<void>; resolve: () => void }>();

  /** Resolves once the server has actually reached the barrier in some transfer. */
  reachedAt(name: string): Promise<void> {
    return this.slot(this.reached, name).promise;
  }

  /** Let the stalled transfer continue. Safe to call before it arrives. */
  release(name: string): void {
    this.slot(this.released, name).resolve();
  }

  /** Called by the server when it hits the barrier; returns once the test releases it. */
  async hold(name: string): Promise<void> {
    this.slot(this.reached, name).resolve();
    await this.slot(this.released, name).promise;
  }

  /**
   * Release every barrier and drop all state, so a second test may reuse a name.
   *
   * Releasing first is not tidiness: a transfer awaiting a slot holds a reference to that exact
   * promise, so clearing the map alone would leave it waiting forever and the server would never
   * close.
   */
  reset(): void {
    for (const slot of this.released.values()) slot.resolve();
    this.reached.clear();
    this.released.clear();
  }

  private slot(
    store: Map<string, { promise: Promise<void>; resolve: () => void }>,
    name: string,
  ): { promise: Promise<void>; resolve: () => void } {
    const existing = store.get(name);
    if (existing) return existing;
    let resolve = (): void => {};
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    const created = { promise, resolve };
    store.set(name, created);
    return created;
  }
}
