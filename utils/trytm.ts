// Bltantly copied from https://github.com/bdsqqq/try/blob/main/src/index.ts

import { sleep } from "./sleep.ts";

export const tryAsync = async <T>(
  promise: Promise<T>
): Promise<[T, null] | [null, Error]> => {
  try {
    const data = await promise;
    return [data, null];
  } catch (throwable) {
    if (throwable instanceof Error) return [null, throwable];

    throw throwable;
  }
};

export const trySync = <T>(fnCall: () => T): [T | null, Error | null] => {
  try {
    return [fnCall(), null];
  } catch (throwable) {
    if (throwable instanceof Error) return [null, throwable];

    throw throwable;
  }
};

export const tryAsyncWithRetries = async <T>(
  promise: () => Promise<T>,
  retries: number,
  retryDelay: number,
  logError: boolean = false
): Promise<[T, null] | [null, Error]> => {
  let error: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const data = await promise();
      return [data, null];
    } catch (throwable) {
      if (throwable instanceof Error) error = throwable;
      if (logError) {
        console.warn(throwable);
      }
      await sleep(retryDelay);
    }
  }

  return [null, error as Error];
};
