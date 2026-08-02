const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Place an event card against the chart's snapped data point, never against the
 * free-moving cursor. The viewport is the only hard boundary: constraining the
 * card to the chart rectangle can push a tall card away from its point.
 */
export function getFloatingEventCardPosition(
  pointer,
  { width, height, gap = 14, anchorLead = 40 } = {},
) {
  if (typeof window === "undefined") return { x: 0, y: 0 };

  const padding = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = Math.min(width, viewportWidth - padding * 2);
  const cardHeight = Math.min(height, viewportHeight - padding * 2);
  const anchorX = Number.isFinite(pointer?.snapX)
    ? pointer.snapX
    : pointer?.clientX;
  const anchorY = Number.isFinite(pointer?.snapY)
    ? pointer.snapY
    : pointer?.clientY;

  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
    return {
      x: Math.round((viewportWidth - cardWidth) / 2),
      y: Math.round((viewportHeight - cardHeight) / 2),
      side: "right",
      anchorOffsetY: anchorLead,
      anchorGap: gap,
    };
  }

  const fitsRight = anchorX + gap + cardWidth <= viewportWidth - padding;
  const fitsLeft = anchorX - gap - cardWidth >= padding;
  const horizontalRoomRight = viewportWidth - padding - anchorX;
  const horizontalRoomLeft = anchorX - padding;

  if (fitsRight || fitsLeft) {
    const side =
      fitsRight && (!fitsLeft || horizontalRoomRight >= horizontalRoomLeft)
        ? "right"
        : "left";
    const desiredX =
      side === "right"
        ? anchorX + gap
        : anchorX - cardWidth - gap;
    const x = clamp(desiredX, padding, viewportWidth - padding - cardWidth);
    const y = clamp(
      anchorY - anchorLead,
      padding,
      viewportHeight - padding - cardHeight,
    );
    const anchorOffsetY = clamp(anchorY - y, 8, cardHeight - 8);
    const cardEdgeX = side === "right" ? x : x + cardWidth;

    return {
      x,
      y,
      side,
      anchorOffsetY,
      anchorGap: Math.max(8, Math.abs(cardEdgeX - anchorX)),
      anchorX,
      anchorY,
    };
  }

  // On narrow screens the card becomes a point-anchored popover above/below
  // the node, keeping the selected point visible and tappable.
  const fitsBelow = anchorY + gap + cardHeight <= viewportHeight - padding;
  const fitsAbove = anchorY - gap - cardHeight >= padding;
  const side =
    fitsBelow || (!fitsAbove && viewportHeight - anchorY >= anchorY)
      ? "below"
      : "above";
  const x = clamp(
    anchorX - cardWidth / 2,
    padding,
    viewportWidth - padding - cardWidth,
  );
  const desiredY =
    side === "below" ? anchorY + gap : anchorY - cardHeight - gap;
  const y = clamp(desiredY, padding, viewportHeight - padding - cardHeight);
  const cardEdgeY = side === "below" ? y : y + cardHeight;

  return {
    x,
    y,
    side,
    anchorOffsetX: clamp(anchorX - x, 8, cardWidth - 8),
    anchorGap: Math.max(8, Math.abs(cardEdgeY - anchorY)),
    anchorX,
    anchorY,
  };
}
