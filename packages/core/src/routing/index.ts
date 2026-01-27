/**
 * Routing Module
 *
 * File-based routing for org-press.
 */

export {
  resolveRoutes,
  routeToOutputPath,
  findRoute,
  getChildRoutes,
  getRoutesAtDepth,
  buildRouteTree,
} from "./routes.ts";

export type {
  RouteEntry,
  ResolveRoutesOptions,
  RouteTreeNode,
} from "./routes.ts";
