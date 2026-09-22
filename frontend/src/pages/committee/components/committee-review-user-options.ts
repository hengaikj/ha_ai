import type { CommitteeUserOption } from "@/types/committee";

export function filterResponsibleUserOptions(
  users: CommitteeUserOption[],
  reviewerUserId?: string | number,
) {
  const normalizedReviewerUserId = String(reviewerUserId ?? "");
  if (!normalizedReviewerUserId) return users;
  return users.filter(
    (user) => String(user.userId) !== normalizedReviewerUserId,
  );
}

export function filterNoticeUserOptions(
  users: CommitteeUserOption[],
  reviewerUserId?: string | number,
) {
  return filterResponsibleUserOptions(users, reviewerUserId);
}
