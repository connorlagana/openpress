import { CopyPrompt } from "./copy-prompt";
import { MiniSite, type MiniPalette, type MiniTemplate } from "./mini-site";

const EXAMPLES: { label: string; template: MiniTemplate; palette: MiniPalette; name: string; headline: string; prompt: (app: string) => string }[] = [
  {
    label: "Blog",
    template: "editorial",
    palette: "warm",
    name: "Field Notes",
    headline: "Hello, Lisbon",
    prompt: (app) => `Use ${app} to start a travel blog called "Field Notes" with the editorial template, warm colors and serif headings. Write a first post about three days in Lisbon with a photo, set its SEO title and description, and publish it.`,
  },
  {
    label: "Company",
    template: "saas",
    palette: "bold",
    name: "Lumen",
    headline: "Invoices that send themselves",
    prompt: (app) => `Use ${app} to make a landing page for my product "Lumen", an invoicing tool for freelancers. Use the saas template with a bold indigo accent: a headline, three feature blurbs and a "Join the waitlist" button. Publish it and send me the link.`,
  },
  {
    label: "Portfolio",
    template: "portfolio",
    palette: "minimal",
    name: "Ana Sousa",
    headline: "Product designer in Porto",
    prompt: (app) => `Use ${app} to build my portfolio, "Ana Sousa · Product designer". Minimal black and white, the portfolio template, an about section and four projects with short descriptions. Save it as a draft and show me before publishing.`,
  },
];

/** Three ready-to-paste prompts, each with a sketch of what it builds. */
export function Examples({ appName, rootDomain }: { appName: string; rootDomain: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {EXAMPLES.map((e) => (
        <article key={e.label} className="flex min-w-0 flex-col gap-4">
          <div className="text-[11px]">
            <MiniSite template={e.template} palette={e.palette} name={e.name} headline={e.headline} host={`${e.name.toLowerCase().replace(/[^a-z]+/g, "-")}.${rootDomain}`} style={{ height: 250 }} />
          </div>
          <CopyPrompt prompt={e.prompt(appName)} label={e.label} />
        </article>
      ))}
    </div>
  );
}
