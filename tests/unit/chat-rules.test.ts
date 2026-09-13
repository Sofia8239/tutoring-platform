import { describe, expect, it } from "vitest";

import {
  chatSenderTypeForRole,
  MAX_CHAT_MESSAGE_LENGTH,
  validateChatMessage,
} from "@/lib/chat-rules";
import { UserRole } from "@/generated/prisma/enums";

describe("chatSenderTypeForRole", () => {
  it("maps student -> STUDENT, everyone else -> TEACHER", () => {
    expect(chatSenderTypeForRole(UserRole.STUDENT)).toBe("STUDENT");
    expect(chatSenderTypeForRole(UserRole.TEACHER)).toBe("TEACHER");
    expect(chatSenderTypeForRole(UserRole.ADMIN)).toBe("TEACHER");
  });
});

describe("validateChatMessage", () => {
  it("passes normal text", () => {
    expect(validateChatMessage("  привіт  ")).toBeNull();
  });
  it("rejects empty / whitespace", () => {
    expect(validateChatMessage("")).toBe("empty");
    expect(validateChatMessage("   \n ")).toBe("empty");
  });
  it("rejects over-long", () => {
    expect(validateChatMessage("x".repeat(MAX_CHAT_MESSAGE_LENGTH + 1))).toBe(
      "too-long",
    );
  });
});
