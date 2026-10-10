import { Home } from "@/features/workspace/home";
import { requireOwner } from "@/lib/server/auth";
import { library } from "@/lib/server/repository";
import { capabilities } from "@/lib/server/config";
export default async function DashboardPage() {
  const owner = await requireOwner();
  let data;
  try {
    data = await library(owner, {
      q: "",
      page: 1,
      tool: "all",
      favorite: "false",
    });
  } catch {
    return (
      <Home
        items={[]}
        capabilities={capabilities()}
        error="Your history is unavailable. Check the database connection."
      />
    );
  }
  return <Home items={data.items} capabilities={capabilities()} />;
}
