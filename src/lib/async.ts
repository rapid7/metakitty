/** Runs `task` over `items`, at most `concurrency` in flight at a time. */
export async function runInBatches<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(task));
  }
}
