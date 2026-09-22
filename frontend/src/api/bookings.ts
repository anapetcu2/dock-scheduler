import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, unwrap } from "./client";
import type { components, operations } from "./schema";

export type Booking = components["schemas"]["BookingRead"];
export type BookingDetail = components["schemas"]["BookingDetail"];
export type BookingKind = components["schemas"]["BookingKind"];
export type BookingStatus = components["schemas"]["BookingStatus"];
export type BookingCreateInput = operations["create_booking"]["requestBody"]["content"]["application/json"];
export type BookingUpdateInput = operations["update_booking"]["requestBody"]["content"]["application/json"];
export type BookingValidateInput =
  operations["validate_booking"]["requestBody"]["content"]["application/json"];

export interface BookingListFilters {
  start?: string;
  end?: string;
  berth_id?: number;
  vessel_id?: number;
  kind?: BookingKind;
  status?: BookingStatus;
}

const bookingsKey = (filters: BookingListFilters) => ["bookings", filters] as const;

export function useBookings(filters: BookingListFilters) {
  return useQuery({
    queryKey: bookingsKey(filters),
    queryFn: async () => unwrap<Booking[]>(await api.GET("/api/bookings", { params: { query: filters } })),
  });
}

export function useBooking(bookingId: number | undefined) {
  return useQuery({
    queryKey: ["bookings", "detail", bookingId],
    enabled: bookingId !== undefined,
    queryFn: async () =>
      unwrap<BookingDetail>(
        await api.GET("/api/bookings/{booking_id}", {
          params: { path: { booking_id: bookingId as number } },
        }),
      ),
  });
}

export function useValidateBooking() {
  return useMutation({
    mutationFn: async (input: BookingValidateInput) =>
      unwrap(await api.POST("/api/bookings/validate", { body: input })),
  });
}

function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["bookings"] });
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (input: BookingCreateInput) =>
      unwrap<Booking>(await api.POST("/api/bookings", { body: input })),
    onSuccess: invalidate,
  });
}

export function useUpdateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: BookingUpdateInput }) =>
      unwrap<Booking>(
        await api.PATCH("/api/bookings/{booking_id}", {
          params: { path: { booking_id: id } },
          body: input,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (id: number) =>
      unwrap<Booking>(
        await api.POST("/api/bookings/{booking_id}/cancel", { params: { path: { booking_id: id } } }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error, response } = await api.DELETE("/api/bookings/{booking_id}", {
        params: { path: { booking_id: id } },
      });
      if (error !== undefined) {
        throw new ApiError(response.status, error);
      }
    },
    onSuccess: invalidate,
  });
}
