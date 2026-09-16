import { describe, expect, it } from "vitest";

import { resolvePaymentProviderChoice } from "@/server/payments/provider/choice";

describe("resolvePaymentProviderChoice", () => {
  it("is null when no provider is chosen (payments off by default)", () => {
    expect(resolvePaymentProviderChoice({})).toBeNull();
  });

  it("is null when the chosen provider's keys are missing", () => {
    expect(
      resolvePaymentProviderChoice({ PAYMENT_PROVIDER: "liqpay" }),
    ).toBeNull();
    expect(
      resolvePaymentProviderChoice({ PAYMENT_PROVIDER: "monobank" }),
    ).toBeNull();
  });

  it("resolves liqpay once both keys are present", () => {
    expect(
      resolvePaymentProviderChoice({
        PAYMENT_PROVIDER: "liqpay",
        LIQPAY_PUBLIC_KEY: "pub",
        LIQPAY_PRIVATE_KEY: "priv",
      }),
    ).toEqual({ provider: "liqpay", publicKey: "pub", privateKey: "priv" });
  });

  it("resolves monobank once the token is present", () => {
    expect(
      resolvePaymentProviderChoice({
        PAYMENT_PROVIDER: "monobank",
        MONOBANK_ACQUIRING_TOKEN: "tok",
      }),
    ).toEqual({ provider: "monobank", token: "tok" });
  });

  it("ignores leftover liqpay keys when monobank is chosen without its own token", () => {
    expect(
      resolvePaymentProviderChoice({
        PAYMENT_PROVIDER: "monobank",
        LIQPAY_PUBLIC_KEY: "pub",
        LIQPAY_PRIVATE_KEY: "priv",
      }),
    ).toBeNull();
  });
});
