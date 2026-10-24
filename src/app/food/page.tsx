import { redirect } from "next/navigation";

// Food comparison now lives under Money.
export default function FoodPage() {
  redirect("/money?tab=food");
}
