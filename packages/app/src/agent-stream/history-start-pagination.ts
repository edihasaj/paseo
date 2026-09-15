export const HISTORY_START_THRESHOLD_PX = 96;

export type HistoryStartPaginationState =
  | { status: "dormant" }
  | { status: "ready" }
  | { status: "loading"; requestedProgressKey: string; requestObserved: boolean }
  | { status: "settling"; loadedProgressKey: string }
  | { status: "latched" };

export interface HistoryStartPaginationInput {
  distanceFromHistoryStart: number;
  hasOlderHistory: boolean;
  isLoadingOlderHistory: boolean;
  isReady: boolean;
  progressKey: string | null;
}

export interface HistoryStartPaginationTransition {
  state: HistoryStartPaginationState;
  shouldLoad: boolean;
}

export function createHistoryStartPaginationState(): HistoryStartPaginationState {
  return { status: "dormant" };
}

export function isHistoryStartLoadingOperation(state: HistoryStartPaginationState): boolean {
  return state.status === "loading" || state.status === "settling";
}

export function rearmHistoryStartPagination(
  state: HistoryStartPaginationState,
): HistoryStartPaginationState {
  return state.status === "dormant" || state.status === "latched" ? { status: "ready" } : state;
}

/**
 * Abandons any in-flight or settling older-history load, e.g. because the panel that
 * owns it went inactive (retained but hidden behind a react-freeze boundary). A
 * "settling" operation resumed on reactivation reevaluates against whatever geometry
 * happens to exist at that moment rather than the continuous layout it was tracking,
 * so letting it continue can chain-load and reapply a stale anchor correction instead
 * of preserving the reader's position. "ready" lets the next evaluate decide fresh,
 * without disabling pagination the way "dormant" would for a chat the reader already
 * engaged with.
 */
export function abandonHistoryStartPagination(
  state: HistoryStartPaginationState,
): HistoryStartPaginationState {
  return state.status === "dormant" ? state : { status: "ready" };
}

export function abandonHistoryStartPaginationRequest(
  state: HistoryStartPaginationState,
  requestedProgressKey: string,
): HistoryStartPaginationState {
  if (
    state.status !== "loading" ||
    state.requestObserved ||
    state.requestedProgressKey !== requestedProgressKey
  ) {
    return state;
  }
  return { status: "latched" };
}

export function evaluateHistoryStartPagination(
  state: HistoryStartPaginationState,
  input: HistoryStartPaginationInput,
): HistoryStartPaginationTransition {
  if (state.status === "dormant") {
    return { state, shouldLoad: false };
  }
  if (state.status === "loading") {
    if (input.progressKey !== null && input.progressKey !== state.requestedProgressKey) {
      return {
        state: { status: "settling", loadedProgressKey: input.progressKey },
        shouldLoad: false,
      };
    }
    if (input.isLoadingOlderHistory && !state.requestObserved) {
      return { state: { ...state, requestObserved: true }, shouldLoad: false };
    }
    if (!input.isLoadingOlderHistory && !input.hasOlderHistory) {
      return { state: { status: "latched" }, shouldLoad: false };
    }
    if (
      state.requestObserved &&
      !input.isLoadingOlderHistory &&
      input.progressKey === state.requestedProgressKey
    ) {
      return { state: { status: "latched" }, shouldLoad: false };
    }
    return { state, shouldLoad: false };
  }

  if (state.status === "settling") {
    return { state, shouldLoad: false };
  }

  const isAtHistoryStart = input.distanceFromHistoryStart <= HISTORY_START_THRESHOLD_PX;
  if (!isAtHistoryStart) {
    return state.status === "ready"
      ? { state, shouldLoad: false }
      : { state: { status: "ready" }, shouldLoad: false };
  }
  if (
    state.status === "latched" ||
    !input.isReady ||
    !input.hasOlderHistory ||
    input.isLoadingOlderHistory ||
    input.progressKey === null
  ) {
    return { state, shouldLoad: false };
  }
  return {
    state: {
      status: "loading",
      requestedProgressKey: input.progressKey,
      requestObserved: false,
    },
    shouldLoad: true,
  };
}

export function settleHistoryStartPagination(
  state: HistoryStartPaginationState,
  input: HistoryStartPaginationInput,
): HistoryStartPaginationTransition {
  if (state.status !== "settling") {
    return { state, shouldLoad: false };
  }
  const isAtHistoryStart = input.distanceFromHistoryStart <= HISTORY_START_THRESHOLD_PX;
  if (
    !isAtHistoryStart ||
    !input.isReady ||
    !input.hasOlderHistory ||
    input.isLoadingOlderHistory ||
    input.progressKey === null
  ) {
    return {
      state: isAtHistoryStart ? { status: "latched" } : { status: "ready" },
      shouldLoad: false,
    };
  }
  return {
    state: {
      status: "loading",
      requestedProgressKey: input.progressKey,
      requestObserved: false,
    },
    shouldLoad: true,
  };
}
