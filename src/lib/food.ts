import type { DeliveryApp, FoodComparison, FoodQuote } from "@/lib/types";

/** Group quotes by restaurant and rank apps by total cost. */
export function compareFood(quotes: FoodQuote[], restaurant?: string): FoodComparison[] {
  const q = restaurant?.toLowerCase().trim();
  const byRestaurant = new Map<string, FoodQuote[]>();
  for (const quote of quotes) {
    if (q && !quote.restaurant.toLowerCase().includes(q)) continue;
    byRestaurant.set(quote.restaurant, [...(byRestaurant.get(quote.restaurant) ?? []), quote]);
  }
  return [...byRestaurant.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => a.total - b.total);
    return {
      restaurant: name,
      items: sorted[0].items,
      quotes: sorted,
      cheapest: sorted[0].app,
      savings: Math.round((sorted.at(-1)!.total - sorted[0].total) * 100) / 100,
      conveniencePointsApps: sorted.filter((s) => s.acceptsConveniencePoints).map((s) => s.app),
    };
  });
}

/**
 * Link that searches the delivery app for the restaurant. On phones with the app installed these
 * domains open the app directly (universal links); otherwise the website opens.
 */
export function orderUrl(app: DeliveryApp, restaurant: string): string {
  const q = encodeURIComponent(restaurant.replace(/^SAMPLE\s+/i, ""));
  switch (app) {
    case "DoorDash":
      return `https://www.doordash.com/search/store/${q}/`;
    case "Uber Eats":
      return `https://www.ubereats.com/search?q=${q}`;
    case "Grubhub":
      return `https://www.grubhub.com/search?queryText=${q}`;
  }
}
