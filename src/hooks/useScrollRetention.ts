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
  const [node, setNode] = useState<T | null>(null);
  const last = useRef<ScrollPos>({ top: 0, left: 0 });

  const setRef = useCallback((next: T | null) => {
    ref.current = next;
    setNode(next);
  }, []);

  useEffect(() => {
    if (!node) return;

    const handleScroll = () => {
      last.current = { top: node.scrollTop, left: node.scrollLeft };
    };

    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, [node]);

  useLayoutEffect(() => {
    if (!shouldRestore) return;
    const current = ref.current;
    if (!current) return;
    current.scrollTop = last.current.top;
    current.scrollLeft = last.current.left;
  }, [shouldRestore, ...deps]);

  return setRef;
}
