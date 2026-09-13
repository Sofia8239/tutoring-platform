import type { Metadata } from "next";

import { getUsableInvitation } from "@/server/auth/invitations";

import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Приєднатися" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getUsableInvitation(token);

  if (!invitation) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Запрошення недоступне
        </h1>
        <p className="text-muted text-sm">
          Посилання недійсне, вже використане або протерміноване. Попросіть
          викладача надіслати нове.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Створення акаунта
        </h1>
        <p className="text-muted text-sm">
          Вас запросили як{" "}
          {invitation.role === "STUDENT" ? "учня" : "викладача"}. Придумайте
          пароль, щоб завершити реєстрацію.
        </p>
      </div>
      <JoinForm token={token} email={invitation.email} />
    </div>
  );
}
