import { redirect } from "next/navigation";

/** Root of the grader app redirects to /grade. */
export default function Home() {
  redirect("/grade");
}
