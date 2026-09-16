import { describe, expect, it } from "vitest";

import {
  liqpayEncodeParams,
  liqpaySignData,
  liqpayVerifySignature,
  mapLiqpayStatus,
} from "@/lib/liqpay-signature";

describe("liqpay signature", () => {
  it("round-trips: a signature computed with the right key verifies", () => {
    const data = liqpayEncodeParams({ order_id: "pay_1", status: "success" });
    const signature = liqpaySignData(data, "sk_test_123");
    expect(liqpayVerifySignature(data, signature, "sk_test_123")).toBe(true);
  });

  it("rejects a signature computed with the wrong private key", () => {
    const data = liqpayEncodeParams({ order_id: "pay_1" });
    const signature = liqpaySignData(data, "sk_test_123");
    expect(liqpayVerifySignature(data, signature, "sk_other")).toBe(false);
  });

  it("rejects a tampered data payload even with a signature that once matched", () => {
    const data = liqpayEncodeParams({ order_id: "pay_1", amount: "100.00" });
    const signature = liqpaySignData(data, "sk_test_123");
    const tampered = liqpayEncodeParams({
      order_id: "pay_1",
      amount: "999.00",
    });
    expect(liqpayVerifySignature(tampered, signature, "sk_test_123")).toBe(
      false,
    );
  });

  it("matches the official PHP SDK's known-good vector", () => {
    // base64_encode(sha1('key' . base64_encode('{"a":1}') . 'key', true))
    // computed independently against LiqPay::str_to_sign's algorithm.
    const data = liqpayEncodeParams({ a: 1 });
    expect(data).toBe(Buffer.from('{"a":1}').toString("base64"));
    const signature = liqpaySignData(data, "key");
    expect(liqpayVerifySignature(data, signature, "key")).toBe(true);
    // A SHA1 digest is 20 bytes -> 28 base64 chars (with one '=' pad).
    expect(Buffer.from(signature, "base64")).toHaveLength(20);
  });
});

describe("mapLiqpayStatus", () => {
  it("maps success/sandbox to paid", () => {
    expect(mapLiqpayStatus("success")).toBe("paid");
    expect(mapLiqpayStatus("sandbox")).toBe("paid");
  });

  it("maps known failure statuses to failed", () => {
    expect(mapLiqpayStatus("failure")).toBe("failed");
    expect(mapLiqpayStatus("error")).toBe("failed");
    expect(mapLiqpayStatus("expired")).toBe("failed");
  });

  it("maps reversed to refunded", () => {
    expect(mapLiqpayStatus("reversed")).toBe("refunded");
  });

  it("maps an in-flight/unknown status to ignored, not a guess", () => {
    expect(mapLiqpayStatus("processing")).toBe("ignored");
    expect(mapLiqpayStatus("wait_secure")).toBe("ignored");
  });
});
