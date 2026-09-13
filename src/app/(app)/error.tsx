"use client";

import { useEffect } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-10">
      <EmptyState
        icon={<Icon name="bell" className="size-5" />}
        title="Щось пішло не так"
        description="Сталася помилка під час завантаження цієї сторінки. Спробуйте ще раз."
        action={
          <button
            type="button"
            onClick={reset}
            className={buttonClass("primary", "sm")}
          >
            Спробувати знову
          </button>
        }
      />
    </div>
  );
}
