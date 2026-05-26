/**
 * @fileoverview 2D collision detection utilities for games.
 *
 * Supports AABB, circle, point-in-rect, circle-vs-rect, line intersection,
 * Separating Axis Theorem (SAT) for rotated rectangles, and closest-point
 * queries.
 *
 * @example
 * ```js
 * import { aabbCollision, satCollision } from './collision.js';
 *
 * if (aabbCollision(player, wall)) { /* overlap *\/ }
 * ```
 */

// ---------------------------------------------------------------------------
// AABB
// ---------------------------------------------------------------------------

/**
 * Tests axis-aligned bounding box (AABB) overlap.
 *
 * @param {{ x: number, y: number, width: number, height: number }} a – First rect.
 * @param {{ x: number, y: number, width: number, height: number }} b – Second rect.
 * @returns {boolean} `true` if the boxes overlap.
 */
export function aabbCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ---------------------------------------------------------------------------
// Circle
// ---------------------------------------------------------------------------

/**
 * Tests circle-to-circle collision.
 *
 * @param {{ x: number, y: number, radius: number }} a – First circle.
 * @param {{ x: number, y: number, radius: number }} b – Second circle.
 * @returns {boolean} `true` if circles overlap.
 */
export function circleCollision(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distSq = dx * dx + dy * dy;
  const radSum = a.radius + b.radius;
  return distSq < radSum * radSum;
}

/**
 * Tests circle vs axis-aligned rectangle collision.
 *
 * Finds the closest point on the rect to the circle center and checks
 * distance against the circle's radius.
 *
 * @param {{ x: number, y: number, radius: number }} circle
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {boolean} `true` if the circle overlaps the rectangle.
 */
export function circleRectCollision(circle, rect) {
  const closest = getClosestPointOnRect(circle.x, circle.y, rect);
  const dx = circle.x - closest.x;
  const dy = circle.y - closest.y;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

// ---------------------------------------------------------------------------
// Point-in-rect
// ---------------------------------------------------------------------------

/**
 * Tests whether a point lies inside an axis-aligned rectangle.
 *
 * @param {number} px – Point X.
 * @param {number} py – Point Y.
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {boolean} `true` if the point is inside.
 */
export function pointInRect(px, py, rect) {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the closest point on the boundary (or interior) of an AABB to
 * a given point.
 *
 * If the point is inside the rect, the returned point equals the input.
 *
 * @param {number} px – Point X.
 * @param {number} py – Point Y.
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {{ x: number, y: number }} Closest point on the rectangle.
 */
export function getClosestPointOnRect(px, py, rect) {
  return {
    x: Math.max(rect.x, Math.min(px, rect.x + rect.width)),
    y: Math.max(rect.y, Math.min(py, rect.y + rect.height)),
  };
}

// ---------------------------------------------------------------------------
// Line intersection
// ---------------------------------------------------------------------------

/**
 * Tests whether two line segments intersect and returns the intersection point.
 *
 * Uses the standard 2D cross-product method. Returns `null` if the segments
 * are parallel, collinear, or do not intersect.
 *
 * @param {{ x: number, y: number }} p1 – Start of segment A.
 * @param {{ x: number, y: number }} p2 – End of segment A.
 * @param {{ x: number, y: number }} p3 – Start of segment B.
 * @param {{ x: number, y: number }} p4 – End of segment B.
 * @returns {{ x: number, y: number } | null} Intersection point, or `null`.
 */
export function lineIntersection(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;

  // Parallel or collinear
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * d1x,
      y: p1.y + t * d1y,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// SAT (Separating Axis Theorem)
// ---------------------------------------------------------------------------

/**
 * Projects a set of vertices onto a given axis and returns the min/max
 * scalar range.
 *
 * @param {Array<{ x: number, y: number }>} vertices
 * @param {{ x: number, y: number }} axis – Unit vector preferred but not required.
 * @returns {{ min: number, max: number }}
 */
function projectVertices(vertices, axis) {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const dot = vertices[i].x * axis.x + vertices[i].y * axis.y;
    if (dot < min) min = dot;
    if (dot > max) max = dot;
  }

  return { min, max };
}

/**
 * Returns the axes (normals of each edge) to test for a set of vertices.
 *
 * @param {Array<{ x: number, y: number }>} vertices
 * @returns {Array<{ x: number, y: number }>}
 */
function getAxes(vertices) {
  const axes = [];
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const edgeX = vertices[j].x - vertices[i].x;
    const edgeY = vertices[j].y - vertices[i].y;
    // Normalize perpendicular vector
    const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
    if (len < 1e-10) continue;
    axes.push({ x: -edgeY / len, y: edgeX / len });
  }
  return axes;
}

/**
 * Tests overlap between two **convex** polygons using the Separating Axis
 * Theorem. Works for rotated rectangles, triangles, etc.
 *
 * For simple AABB-vs-AABB, prefer {@link aabbCollision} which is faster.
 *
 * @example
 * ```js
 * // Rotated rect (4 corners)
 * const rectA = [
 *   { x: 10, y: 10 }, { x: 110, y: 10 },
 *   { x: 110, y: 60 }, { x: 10, y: 60 },
 * ];
 * const rectB = [
 *   { x: 50, y: 30 }, { x: 150, y: 40 },
 *   { x: 140, y: 80 }, { x: 40, y: 70 },
 * ];
 * if (satCollision(rectA, rectB)) { /* overlap *\/ }
 * ```
 *
 * @param {Array<{ x: number, y: number }>} verticesA – Convex polygon A (ordered CCW or CW).
 * @param {Array<{ x: number, y: number }>} verticesB – Convex polygon B.
 * @returns {boolean} `true` if the polygons overlap.
 */
export function satCollision(verticesA, verticesB) {
  const axes = getAxes(verticesA).concat(getAxes(verticesB));

  for (let i = 0; i < axes.length; i++) {
    const projA = projectVertices(verticesA, axes[i]);
    const projB = projectVertices(verticesB, axes[i]);

    // If there's a gap on ANY axis → no collision
    if (projA.max < projB.min || projB.max < projA.min) {
      return false;
    }
  }

  return true;
}
