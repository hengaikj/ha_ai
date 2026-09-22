type RouteScrollPosition = {
  tagName: string;
  className: string;
  occurrence: number;
  top: number;
  left: number;
};

const routeScrollPositions = new Map<string, RouteScrollPosition[]>();

function isScrollable(element: HTMLElement) {
  const style = globalThis.window?.getComputedStyle(element);
  const vertical =
    element.scrollHeight > element.clientHeight &&
    (style?.overflowY === "auto" || style?.overflowY === "scroll");
  const horizontal =
    element.scrollWidth > element.clientWidth &&
    (style?.overflowX === "auto" || style?.overflowX === "scroll");
  return vertical || horizontal;
}

function elementClassName(element: HTMLElement) {
  return Array.from(element.classList).sort().join(".");
}

function elementKey(element: HTMLElement) {
  return `${element.tagName.toLowerCase()}.${elementClassName(element)}`;
}

function findOccurrence(element: HTMLElement, key: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(element.tagName))
    .filter((candidate) => elementKey(candidate) === key)
    .indexOf(element);
}

function findElement(position: RouteScrollPosition) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(position.tagName),
  ).filter(
    (candidate) =>
      elementKey(candidate) ===
      `${position.tagName}.${position.className}`,
  )[position.occurrence];
}

export function saveRouteScroll(fullPath: string) {
  if (typeof document === "undefined") return;

  const positions = Array.from(
    document.querySelectorAll<HTMLElement>(".app-layout__content, *"),
  )
    .filter(isScrollable)
    .map((element) => ({
      tagName: element.tagName.toLowerCase(),
      className: elementClassName(element),
      occurrence: findOccurrence(element, elementKey(element)),
      top: element.scrollTop,
      left: element.scrollLeft,
    }));

  if (positions.length) {
    routeScrollPositions.set(fullPath, positions);
  }
}

export function restoreRouteScroll(fullPath: string) {
  const positions = routeScrollPositions.get(fullPath);
  if (typeof window === "undefined") return;

  if (!positions?.length) {
    void window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>(".app-layout__content, *")
        .forEach((element) => {
          if (!isScrollable(element)) return;
          element.scrollTop = 0;
          element.scrollLeft = 0;
        });
    });
    return;
  }

  const startedAt = Date.now();
  const restore = () => {
    let allReady = true;
    positions.forEach((position) => {
      const element = findElement(position);
      if (!element) {
        allReady = false;
        return;
      }

      const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
      const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      element.scrollTop = Math.min(position.top, maxTop);
      element.scrollLeft = Math.min(position.left, maxLeft);
      if (position.top > maxTop || position.left > maxLeft) {
        allReady = false;
      }
    });

    if (!allReady && Date.now() - startedAt < 2000) {
      window.setTimeout(restore, 50);
    }
  };

  void window.requestAnimationFrame(restore);
}
