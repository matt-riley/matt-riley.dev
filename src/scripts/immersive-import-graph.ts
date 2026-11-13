export function traceImports(
  graph: Readonly<Record<string, readonly string[]>>,
  entry: string,
): { reachable: string[]; unreachable: string[] } {
  const keys = Object.keys(graph);
  const nodes = new Set(keys);
  if (!nodes.has(entry)) throw new RangeError(`Missing entry module: ${entry}`);

  // Validate disconnected modules too: an invalid graph must not look complete.
  for (const key of keys) {
    for (const dependency of graph[key]) {
      if (!nodes.has(dependency))
        throw new RangeError(
          `Missing imported module: ${dependency} (from ${key})`,
        );
    }
  }

  const visited = new Set<string>();
  const pending = [entry];
  while (pending.length) {
    const key = pending.pop() as string;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const dependency of graph[key]) pending.push(dependency);
  }
  return {
    reachable: keys.filter((key) => visited.has(key)),
    unreachable: keys.filter((key) => !visited.has(key)),
  };
}
