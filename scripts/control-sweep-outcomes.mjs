export function hasControlFailures(results) {
  return results.some(
    (result) =>
      result.result === 'failed' || (result.kind === 'runtime-errors' && result.errors.length > 0),
  );
}
