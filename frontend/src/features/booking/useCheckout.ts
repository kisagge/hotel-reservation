"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { ApiError, qk, unwrap } from "@/lib/api/queries";
import { loginHref } from "@/lib/authRedirect";
import { errorMessage } from "@/lib/errors";
import { bookingHref } from "./checkoutParams";
import type { QuoteIn } from "./useAvailability";

type Guest = { guest_name: string; guest_phone: string };

/** Mock-payment reservation. Guards against double submits even before React re-renders the disabled button. */
export function useCreateReservation(q: QuoteIn | null) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const here = `${usePathname()}?${useSearchParams()}`;
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: (guest: Guest) => unwrap(api.POST("/api/reservations", { body: { ...q!, ...guest } })),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: qk.myReservations });
      qc.invalidateQueries({ queryKey: qk.availability });
      // replace: Back must not return to a checkout whose slot is now our own booking
      router.replace(`/me/reservations?created=${r.code}`);
    },
    onError: (e) => {
      inFlight.current = false; // only a failure re-arms the button; success keeps it locked until we leave
      if (e instanceof ApiError && e.status === 401) return router.push(loginHref(here));
      toast(errorMessage(e instanceof ApiError ? e.code : null), "danger");
      if (e instanceof ApiError && e.status === 409) {
        qc.invalidateQueries({ queryKey: qk.availability });
        router.push(bookingHref(q!));
      }
    },
  });

  const submit = (guest: Guest) => {
    if (!q || inFlight.current) return;
    inFlight.current = true;
    mutation.mutate(guest);
  };
  return { submit, isPending: mutation.isPending || mutation.isSuccess };
}
