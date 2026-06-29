import { redirect } from "next/navigation";

type LoginResetPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginResetPage({
  searchParams,
}: LoginResetPageProps) {
  const params = await searchParams;
  const targetParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        targetParams.append(key, item);
      }
      continue;
    }

    if (value !== undefined) {
      targetParams.set(key, value);
    }
  }

  const query = targetParams.toString();
  redirect(query ? `/forgot-password?${query}` : "/forgot-password");
}
