import Link from "next/link";
import {
  ArrowRight,
  Code2,
  ImageIcon,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
export default function Welcome() {
  return (
    <>
      <header className="landing-nav">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Sparkles size={20} />
          </span>
          NE-AI.
        </Link>
        <span className="private-label">
          <ShieldCheck size={15} />
          Your private creative space
        </span>
      </header>
      <section className="landing-hero">
        <div className="eyebrow">LESS FRICTION. MORE POSSIBILITY.</div>
        <h1>
          A little space
          <br />
          for <em>big ideas.</em>
        </h1>
        <p>
          Think it through. Write something useful. Create something unexpected.
          <br />
          Your AI tools and your work, together in one quiet place.
        </p>
        <Link className="button large" href="/dashboard">
          Open your workspace
          <ArrowRight size={18} />
        </Link>
        <span className="landing-note">
          <ShieldCheck size={14} />
          Private access · Saved work · Your own pace
        </span>
      </section>
      <section className="landing-tools" aria-label="Workspace tools">
        {[
          {
            icon: MessageSquare,
            title: "A thinking partner",
            text: "Find clarity, explore a question, or get a first draft going.",
          },
          {
            icon: Code2,
            title: "From idea to code",
            text: "Work through a problem with readable, useful explanations.",
          },
          {
            icon: ImageIcon,
            title: "Make it visible",
            text: "Turn a few words into an image worth keeping.",
          },
        ].map((t) => (
          <article key={t.title}>
            <t.icon size={24} />
            <h2>{t.title}</h2>
            <p>{t.text}</p>
          </article>
        ))}
      </section>
      <footer className="landing-footer">
        NE-AI · Built for your next idea.
      </footer>
    </>
  );
}
