export interface DomainSubscriptionFlags {
  budgets: boolean;
  goals: boolean;
  recurringTransactions: boolean;
  settings: boolean;
}

function isRoute(pathname: string, route: string): boolean {
  return (
    pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function domainSubscriptionsForPath(
  pathname: string,
): DomainSubscriptionFlags {
  return {
    budgets:
      isRoute(pathname, "/dashboard") ||
      isRoute(pathname, "/budgets") ||
      pathname === "/reports",
    goals:
      isRoute(pathname, "/dashboard") ||
      isRoute(pathname, "/goals") ||
      isRoute(pathname, "/reports"),
    recurringTransactions:
      isRoute(pathname, "/dashboard") ||
      isRoute(pathname, "/recurring") ||
      isRoute(pathname, "/projections"),
    settings:
      isRoute(pathname, "/settings"),
  };
}
