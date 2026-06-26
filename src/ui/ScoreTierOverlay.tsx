import { useEffect, useRef, useState } from "react";
import type { GameHooks } from "../core/types";

export type ScoreTierAward = "gold" | "silver" | "bronze" | "none";

export interface ScoreTierRunResult {
  outcome: "won" | "lost";
  score: number;
  deaths: number;
  durationMs: number;
}

export function awardForRun(
  result: ScoreTierRunResult,
  tiers: GameHooks["scoreTiers"]
): ScoreTierAward {
  if (result.outcome !== "won") return "none";
  if (!tiers) return "bronze";
  if (
    result.score >= tiers.gold.minScore &&
    result.deaths <= tiers.gold.maxDeathCount &&
    result.durationMs <= tiers.gold.maxDurationMs
  ) {
    return "gold";
  }
  if (result.score >= tiers.silver.minScore && result.deaths <= tiers.silver.maxDeathCount) {
    return "silver";
  }
  if (result.score >= tiers.bronze.minScore) {
    return "bronze";
  }
  return "none";
}

const STAR_COUNT: Record<ScoreTierAward, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
  none: 0
};

const AWARD_LABEL: Record<ScoreTierAward, string> = {
  gold: "完美通关 ★★★",
  silver: "熟练通关 ★★",
  bronze: "完成本局 ★",
  none: "本局失败"
};

export function ScoreTierOverlay({
  result,
  tiers,
  onRestart,
  onSubmitFeedback,
  iterationHint
}: {
  result: ScoreTierRunResult;
  tiers: GameHooks["scoreTiers"];
  onRestart: () => void;
  onSubmitFeedback?: (input: { rating: number; comment: string }) => Promise<void> | void;
  iterationHint?: string;
}) {
  const award = awardForRun(result, tiers);
  const stars = STAR_COUNT[award];
  const [rating, setRating] = useState<number>(Math.max(stars || 0, 0) || 3);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitRef = useRef(false);

  useEffect(() => {
    setRating(Math.max(stars || 0, 0) || 3);
    setComment("");
    setSubmitted(false);
    submitRef.current = false;
  }, [result.outcome, result.score, result.durationMs, result.deaths, stars]);

  const seconds = Math.max(1, Math.round(result.durationMs / 1000));
  const rationale = tiers?.rationale;

  return (
    <div className="score-tier-overlay" data-result={result.outcome} data-award={award} role="dialog" aria-label="本局成绩">
      <div className="score-tier-card">
        <header className="score-tier-header">
          <span className="score-tier-label">{AWARD_LABEL[award]}</span>
          <div className="score-tier-stars" aria-label={`获得 ${stars} 颗星`}>
            {[1, 2, 3].map((slot) => (
              <span key={slot} className={`score-tier-star ${slot <= stars ? "is-filled" : ""}`} aria-hidden>
                ★
              </span>
            ))}
          </div>
        </header>
        <dl className="score-tier-stats">
          <div>
            <dt>得分</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>用时</dt>
            <dd>{seconds}s</dd>
          </div>
          <div>
            <dt>失误</dt>
            <dd>{result.deaths}</dd>
          </div>
        </dl>
        {rationale ? <p className="score-tier-rationale">{rationale}</p> : null}
        {iterationHint ? <p className="score-tier-hint">改进建议：{iterationHint}</p> : null}

        {onSubmitFeedback ? (
          <form
            className="score-tier-feedback"
            onSubmit={async (event) => {
              event.preventDefault();
              if (submitRef.current) return;
              submitRef.current = true;
              setSubmitting(true);
              try {
                await onSubmitFeedback({ rating, comment: comment.trim() });
                setSubmitted(true);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <label className="score-tier-rating">
              <span>你的评分</span>
              <span className="score-tier-rating-controls" role="radiogroup" aria-label="评分">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`score-tier-rating-pip ${value <= rating ? "is-on" : ""}`}
                    aria-checked={value === rating}
                    role="radio"
                    onClick={() => setRating(value)}
                  >
                    ★
                  </button>
                ))}
              </span>
            </label>
            <textarea
              className="score-tier-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="留下一句感想（可选）"
              maxLength={200}
            />
            <div className="score-tier-actions">
              <button
                type="button"
                className="score-tier-button is-primary"
                onClick={() => {
                  setSubmitted(false);
                  submitRef.current = false;
                  onRestart();
                }}
              >
                再来一次
              </button>
              <button
                type="submit"
                className="score-tier-button"
                disabled={submitting || submitted}
              >
                {submitted ? "已记录" : submitting ? "提交中..." : "提交评分"}
              </button>
            </div>
          </form>
        ) : (
          <div className="score-tier-actions">
            <button
              type="button"
              className="score-tier-button is-primary"
              onClick={onRestart}
            >
              再来一次
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
