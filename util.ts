export async function run<T>(cmdName: string, args: string[]): Promise<T> {
  const cmd = new Deno.Command(cmdName, { args });
  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const errStr = new TextDecoder().decode(stderr);
    throw new Error(`${cmdName} exited with code ${code}. ${errStr}`);
  }

  const outputStr = new TextDecoder().decode(stdout);
  return JSON.parse(outputStr) as T;
}

export async function concurrently<T>(
  items: T[],
  task: (item: T, index: number) => Promise<void>,
  degreeOfParallelism = 5,
): Promise<void> {
  const activePromises: Promise<void>[] = [];
  let currentIndex = 0;

  const runTask = async () => {
    while (currentIndex < items.length) {
      const item = items[currentIndex++];
      const taskPromise = task(item, currentIndex);
      activePromises.push(taskPromise);

      if (activePromises.length >= degreeOfParallelism) {
        await Promise.race(activePromises);
      }

      activePromises.filter((p) => p !== taskPromise);
    }

    await Promise.all(activePromises);
  };

  await runTask();
}
