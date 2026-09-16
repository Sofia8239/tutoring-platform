import { generateKeyPairSync, sign as ecSign } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  MONOBANK_CCY_NUMERIC,
  mapMonobankStatus,
  verifyMonobankSignature,
} from "@/lib/monobank-signature";

// A real P-256 keypair, generated locally — same curve Monobank signs with.
const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const publicKeyPem = publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

function signBody(body: string): string {
  return ecSign("SHA256", Buffer.from(body, "utf8"), privateKey).toString(
    "base64",
  );
}

describe("verifyMonobankSignature", () => {
  it("accepts a signature made with the matching private key", () => {
    const body = JSON.stringify({ invoiceId: "inv_1", status: "success" });
    expect(verifyMonobankSignature(body, signBody(body), publicKeyPem)).toBe(
      true,
    );
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ invoiceId: "inv_1", status: "success" });
    const signature = signBody(body);
    const tampered = JSON.stringify({ invoiceId: "inv_1", status: "failure" });
    expect(verifyMonobankSignature(tampered, signature, publicKeyPem)).toBe(
      false,
    );
  });

  it("rejects a signature from a different key", () => {
    const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const body = JSON.stringify({ invoiceId: "inv_1" });
    const signature = ecSign(
      "SHA256",
      Buffer.from(body, "utf8"),
      other.privateKey,
    ).toString("base64");
    expect(verifyMonobankSignature(body, signature, publicKeyPem)).toBe(false);
  });

  it("rejects garbage input instead of throwing", () => {
    expect(verifyMonobankSignature("{}", "not-base64-!!", publicKeyPem)).toBe(
      false,
    );
  });
});

describe("mapMonobankStatus", () => {
  it("maps success to paid", () => {
    expect(mapMonobankStatus("success")).toBe("paid");
  });
  it("maps failure/expired to failed", () => {
    expect(mapMonobankStatus("failure")).toBe("failed");
    expect(mapMonobankStatus("expired")).toBe("failed");
  });
  it("maps reversed to refunded", () => {
    expect(mapMonobankStatus("reversed")).toBe("refunded");
  });
  it("maps created/processing/hold to ignored, not a guess", () => {
    expect(mapMonobankStatus("created")).toBe("ignored");
    expect(mapMonobankStatus("processing")).toBe("ignored");
    expect(mapMonobankStatus("hold")).toBe("ignored");
  });
});

describe("MONOBANK_CCY_NUMERIC", () => {
  it("has the ISO 4217 numeric code for UAH", () => {
    expect(MONOBANK_CCY_NUMERIC.UAH).toBe(980);
  });
});
