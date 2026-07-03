"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveVideoForInstagram,
  updateVideoStatus,
  type InstagramTarget,
} from "@/lib/db";

export async function skipVideo(formData: FormData) {
  const id = formData.get("id");

  if (typeof id !== "string" || !id) return;

  updateVideoStatus(id, "skipped");
  revalidatePath("/");
}

export async function approveVideo(formData: FormData) {
  const id = formData.get("id");
  const targetType = formData.get("targetType");

  if (
    typeof id !== "string" ||
    !id ||
    (targetType !== "reel" && targetType !== "feed_post")
  ) {
    return;
  }

  approveVideoForInstagram(id, targetType as InstagramTarget);
  revalidatePath("/");
  redirect("/");
}
