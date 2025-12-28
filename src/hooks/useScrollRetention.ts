import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

type ScrollPos = { top: number; left: number };

/**
 * Preserve scroll position for a container that re-renders on data refresh.
 * This prevents the list from jumping to the top after row actions.
 */
export function useScrollRetention<T extends HTMLElement>(
  shouldRestore: boolean,
  deps: DependencyList
) {
  const ref = useRef<T | null>(null);
  const [nodeVersion, setNodeVersion] = useState(0);
  const last = useRef<ScrollPos>({ top: 0, left: 0 });
  const depsRef = useRef<DependencyList>(deps);

  const setRef = useCallback((next: T | null) => {
    if (ref.current !== next) {
      ref.current = next;
      setNodeVersion((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    const current = ref.current;
    if (!current) return;

    const handleScroll = () => {
      last.current = { top: current.scrollTop, left: current.scrollLeft };
    };

    current.addEventListener("scroll", handleScroll);
    return () => current.removeEventListener("scroll", handleScroll);
  }, [nodeVersion]);

  useLayoutEffect(() => {
    const prevDeps = depsRef.current;
    const depsChanged =
      prevDeps.length !== deps.length ||
      deps.some((dep, index) => !Object.is(dep, prevDeps[index]));

    depsRef.current = deps;

    if (!shouldRestore) return;
    const current = ref.current;
    if (!current) return;
    if (!depsChanged) return;

    // Mutating DOM scroll props is necessary to restore the saved position.
    current.scrollTop = last.current.top;
    current.scrollLeft = last.current.left;
  }, [shouldRestore, nodeVersion, deps]);

  return setRef;
}
