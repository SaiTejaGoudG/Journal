import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Convert a MongoDB document's _id to a plain `id` string */
export function docToDict(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}
