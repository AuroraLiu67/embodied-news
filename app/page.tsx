import { site } from "@/lib/site";

export default function Home() {
  return (
    <main>
      <p className="eyebrow">{site.eyebrow}</p>
      <h1>{site.name}</h1>
      <p className="summary">{site.summary}</p>
      <p className="status">工程骨架已就绪，融资情报内容将在后续里程碑接入。</p>
    </main>
  );
}
