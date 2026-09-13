import "server-only";

import { prisma } from "@/lib/prisma";

export type InboxItem = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  createdAt: Date;
  readAt: Date | null;
};

export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<InboxItem[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      createdAt: true,
      readAt: true,
    },
  });
}

export function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
