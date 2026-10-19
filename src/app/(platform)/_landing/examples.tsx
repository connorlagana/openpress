import { CopyPrompt } from "./copy-prompt";
import { MiniSite, type MiniPalette, type MiniTemplate } from "./mini-site";

const EXAMPLES: { label: string; template: MiniTemplate; palette: MiniPalette; name: string; headline: string; prompt: (app: string) => string }[] = [
  {
    label: "Blog",
    template: "editorial",
    palette: "warm",
    name: "Field Notes",
    headline: "Lake Como, without the crowds",
    prompt: (app) => `Use ${app} to start a blog based on my interests. Pick the topic from what you know about me, or ask me a couple of questions first. Choose a template and colors that fit, write a first post with a photo, and publish it.`,
  },
  {
    label: "Company",
    template: "saas",
    palette: "bold",
    name: "Lumen",
    headline: "Your work. Your worth. Paid.",
    prompt: (app) => `Use ${app} to make a landing page for my project. Ask me what it is and who it's for, then write the headline, features and call to action, pick a look that suits it, publish it and send me the link.`,
  },
  {
    label: "Portfolio",
    template: "portfolio",
    palette: "minimal",
    name: "Ana Sousa",
    headline: "Useful things, beautifully simple.",
    prompt: (app) => `Use ${app} to build me a portfolio. Use what you know about my work, and ask about anything you're missing. Add an about section and a few projects with images, then save it as a draft so I can review it before publishing.`,
  },
];

/** Three open-ended starter prompts; the agent fills in the specifics, so the previews are just one possible result. */
export function Examples({ appName, rootDomain }: { appName: string; rootDomain: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {EXAMPLES.map((e) => (
        <article key={e.label} className="flex min-w-0 flex-col gap-4">
          <div className="text-[11px]">
            <MiniSite template={e.template} palette={e.palette} name={e.name} headline={e.headline} host={`${e.name.toLowerCase().replace(/[^a-z]+/g, "-")}.${rootDomain}`} className="ms-example" />
          </div>
          <CopyPrompt prompt={e.prompt(appName)} label={e.label} />
        </article>
      ))}
    </div>
  );
}
