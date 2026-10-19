import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { fakeApi, json } from "@/test/fakeApi";
import { ROOM, USER } from "@/test/fixtures";
import { testClient } from "@/test/render";
import { useLogin } from "./queries";

describe("useLogin", () => {
  it("drops the previous account's cached data but keeps public room data", async () => {
    fakeApi({ "POST /api/auth/login": () => json({ ...USER, id: 2, email: "b@example.com" }) });
    const client = testClient();
    client.setQueryData(["reservations", "me"], [{ id: 1 }]);
    client.setQueryData(["admin", "dashboard"], { today_check_ins: 1 });
    client.setQueryData(["room"], ROOM);
    const { result } = renderHook(() => useLogin(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await act(() => result.current.mutateAsync({ email: "b@example.com", password: "password123" }));
    await waitFor(() => expect(client.getQueryData(["me"])).toMatchObject({ id: 2 }));
    expect(client.getQueryData(["reservations", "me"])).toBeUndefined();
    expect(client.getQueryData(["admin", "dashboard"])).toBeUndefined();
    expect(client.getQueryData(["room"])).toEqual(ROOM);
  });
});
