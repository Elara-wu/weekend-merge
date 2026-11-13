import { z } from "zod";

export const WeekdaySchema = z.enum([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]);

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const ClosingTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/);

export const OpeningWindowSchema = z.object({
  open: TimeSchema,
  close: ClosingTimeSchema,
}).refine(({ open, close }) => open < close, "Closing time must follow opening time");

export const WeeklyOpeningHoursSchema = z.array(z.object({
  days: z.array(WeekdaySchema).min(1),
  intervals: z.array(OpeningWindowSchema),
})).min(1).superRefine((groups, context) => {
  const days = groups.flatMap((group) => group.days);
  for (const day of WeekdaySchema.options) {
    if (days.filter((value) => value === day).length !== 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${day} must appear exactly once` });
    }
  }
});

export const PlaceSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["exhibition", "bookstore", "cafe", "dinner", "park", "night-view"]),
  area: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  tags: z.array(z.string().min(1)).min(1),
  indoor: z.boolean(),
  priceRange: z.object({
    min: z.number().finite().nonnegative(),
    max: z.number().finite().nonnegative(),
  }).refine(({ min, max }) => min <= max, "Price maximum must be at least minimum"),
  weeklyOpeningHours: WeeklyOpeningHoursSchema,
  lastAdmissionTime: TimeSchema.optional(),
  sourceUrl: z.string().url(),
  lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const PlaceListSchema = z.array(PlaceSchema).superRefine((places, context) => {
  const ids = places.map((place) => place.placeId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Place IDs must be unique" });
  }
});

export const SearchPlacesInputSchema = z.object({
  requiredTags: z.array(z.string().min(1)).nullish().transform((value) => value ?? []),
  excludedTags: z.array(z.string().min(1)).nullish().transform((value) => value ?? []),
  maxPricePerPerson: z.number().finite().nonnegative().nullish().transform((value) => value ?? undefined),
  indoorPreference: z.enum(["indoor", "outdoor", "any"]).nullish().transform((value) => value ?? "any"),
  areas: z.array(z.string().min(1)).nullish().transform((value) => value ?? []),
  openBetween: z.object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  }).refine(({ start, end }) => {
    const duration = Date.parse(end) - Date.parse(start);
    return duration > 0 && duration <= 24 * 60 * 60 * 1000;
  }, "Opening interval must be positive and no longer than one day").nullish().transform((value) => value ?? undefined),
  limit: z.number().int().min(1).max(50).nullish().transform((value) => value ?? 10),
});

export const SearchPlacesOutputSchema = z.object({
  places: z.array(PlaceSchema),
});

export const RouteStopSchema = z.object({
  placeId: z.string().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export const EstimateRouteInputSchema = z.object({
  stops: z.array(RouteStopSchema).min(2),
  mode: z.enum(["walking", "transit", "mixed"]).default("mixed"),
});

export const RouteLegSchema = z.object({
  fromPlaceId: z.string().min(1),
  toPlaceId: z.string().min(1),
  mode: z.enum(["walking", "transit"]),
  distanceKm: z.number().nonnegative(),
  durationMinutes: z.number().int().nonnegative(),
});

export const EstimateRouteOutputSchema = z.object({
  legs: z.array(RouteLegSchema),
  totalDistanceKm: z.number().nonnegative(),
  totalDurationMinutes: z.number().int().nonnegative(),
  estimated: z.literal(true),
});

export const BudgetItemSchema = z.object({
  category: z.string().min(1),
  label: z.string().min(1),
  unitPrice: z.number().finite().min(0).max(100_000),
  quantity: z.number().int().min(1).max(100),
});

export const CalculateBudgetInputSchema = z.object({
  items: z.array(BudgetItemSchema).max(100),
  budgetLimit: z.number().finite().min(0).max(1_000_000_000),
  bufferRate: z.number().finite().min(0).max(1),
});

export const CalculateBudgetOutputSchema = z.object({
  subtotal: z.number().finite().nonnegative(),
  buffer: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
  withinBudget: z.boolean(),
  breakdown: z.record(z.number().finite().nonnegative()),
});

export type Place = z.infer<typeof PlaceSchema>;
export type SearchPlacesInput = z.input<typeof SearchPlacesInputSchema>;
export type SearchPlacesOutput = z.infer<typeof SearchPlacesOutputSchema>;
export type EstimateRouteInput = z.input<typeof EstimateRouteInputSchema>;
export type EstimateRouteOutput = z.infer<typeof EstimateRouteOutputSchema>;
export type CalculateBudgetInput = z.input<typeof CalculateBudgetInputSchema>;
export type CalculateBudgetOutput = z.infer<typeof CalculateBudgetOutputSchema>;
