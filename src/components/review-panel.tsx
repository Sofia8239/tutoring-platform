import type { ReviewView } from "@/server/lessons/submissions";

const SEVERITY_LABEL: Record<string, string> = {
  minor: "незначна",
  major: "суттєва",
  critical: "критична",
};

const SEVERITY_CLASS: Record<string, string> = {
  minor: "text-muted",
  major: "text-attention",
  critical: "text-danger",
};

export function ReviewPanel({ review }: { review: NonNullable<ReviewView> }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">
          {review.score === null ? "—" : `${review.score} / 100`}
        </span>
        <span className="text-muted text-xs">{review.model}</span>
      </div>

      <p className="whitespace-pre-wrap">{review.summary}</p>

      {review.errors.length === 0 ? (
        <p className="text-success">Помилок не знайдено.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {review.errors.map((e, i) => (
            <li key={i} className="border-line rounded-btn border p-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.location}</span>
                <span className="text-muted text-xs">{e.type}</span>
                <span
                  className={`text-xs ${SEVERITY_CLASS[e.severity] ?? "text-muted"}`}
                >
                  {SEVERITY_LABEL[e.severity] ?? e.severity}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap">{e.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
