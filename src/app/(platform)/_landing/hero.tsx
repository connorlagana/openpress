"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ClaimName } from "./claim";
import { BlogSite, type BlogPreview } from "./blog-site";

// Example sites an agent could publish. Three columns drift past on a tilted
// plane; scrolling tips the plane back and fades it out.
const SITES: BlogPreview[][] = [
  [
    { palette: "warm", name: "Elsewhere", category: "The slow travel journal", headline: "Lake Como, without the crowds", excerpt: "Sleepy villages, lakeside swims, and the long way home. A guide to doing less in northern Italy.", image: "travel", author: "Sofia Chen", readTime: "6 min", next: "The art of packing for nowhere in particular" },
    { palette: "forest", name: "Crumb & Co.", category: "From the kitchen", headline: "Good bread. Zero alarm clocks.", excerpt: "A slow Sunday loaf with a shattering crust. Let time do the hard part.", image: "food", author: "Ella Brooks", readTime: "5 min", next: "The only butter worth making from scratch" },
    { palette: "minimal", name: "Soft Space", category: "Rooms to live in", headline: "A little less stuff. A lot more home.", excerpt: "Warm wood, afternoon light, and a living room that finally feels like you.", image: "design", author: "Ana Reyes", readTime: "4 min", next: "Five corners that deserve a reading chair" },
  ],
  [
    { palette: "bold", name: "The Sixth Man", category: "Basketball · Culture", headline: "The game is won before the buzzer", excerpt: "Forget the highlight reel. The small, off-ball moments are where great teams are made.", image: "sports", author: "Marcus Cole", readTime: "7 min", next: "In praise of the neighborhood pickup game" },
    { palette: "sunset", name: "Dawn Patrol", category: "Surf · Stories", headline: "One more wave before the world wakes", excerpt: "Cold water, empty lineups, and the morning ritual we would never trade for sleep.", image: "surf", author: "Leo Santos", readTime: "4 min", next: "Chasing swell down the coast" },
    { palette: "warm", name: "Daily Grind", category: "Coffee, considered", headline: "Your best coffee isn't at a café", excerpt: "One good bag of beans, a simple brewer, and a few small changes to your morning.", image: "coffee", author: "Jamie Park", readTime: "5 min", next: "Meet the roasters keeping it small" },
  ],
  [
    { palette: "dark", name: "Block by Block", category: "Crypto, decoded", headline: "Beyond the hype. Inside Bitcoin.", excerpt: "Follow a transaction from your wallet to the blockchain. No price predictions, just the mechanics.", image: "crypto", author: "Alex Morgan", readTime: "8 min", next: "What does your wallet actually hold?" },
    { palette: "forest", name: "The Long Way", category: "Outside, always", headline: "Take the trail with no shortcuts", excerpt: "A weekend above the treeline, where the signal fades and the good conversations start.", image: "outdoors", author: "Finn Walker", readTime: "6 min", next: "Everything I left out of my backpack" },
    { palette: "dark", name: "After Hours", category: "Cities after dark", headline: "When the city turns its lights on", excerpt: "A camera, a late train, and no particular plan. Finding stories on the streets after sunset.", image: "city", author: "Maya Ellis", readTime: "5 min", next: "A love letter to the last train home" },
  ],
];

export function Hero({ appName, rootDomain, signedIn, banner }: { appName: string; rootDomain: string; signedIn: boolean; banner?: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    let queued = false;
    const frame = () => {
      queued = false;
      root.current?.style.setProperty("--h", String(Math.min(1, window.scrollY / (window.innerHeight * 0.9))));
    };
    const tick = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(frame);
      }
    };
    frame();
    addEventListener("scroll", tick, { passive: true });
    return () => removeEventListener("scroll", tick);
  }, []);

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");

  return (
    <section ref={root} className="lp-hero">
      <div className="lp-wall" aria-hidden>
        <div className="lp-wall__plane">
          {SITES.map((col, c) => (
            <div key={c} className="lp-wall__col" style={{ animationDuration: `${46 + c * 9}s`, animationDirection: c % 2 ? "reverse" : "normal" }}>
              {[...col, ...col].map((s, i) => (
                <BlogSite key={i} post={s} host={`${slug(s.name)}.${rootDomain}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="lp-hero__copy">
        {banner ?? (
          <span className="lp-shadow inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-[13px]">
            <span className="size-2 rounded-full bg-signal" aria-hidden />
            Free <span className="text-muted-foreground">hosting + MCP · no card</span>
          </span>
        )}
        <h1 className="max-w-[11em] text-[clamp(38px,4.6vw,62px)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">Websites your AI agent can build and publish.</h1>
        <p className="max-w-[30rem] text-[16px] leading-snug text-muted-foreground">
          Connect Claude, ChatGPT or any MCP client to {appName}, then ask for a site, a post or a redesign. Hosting, SEO and analytics are built in.
        </p>
        {signedIn ? (
          <Link href="/dashboard" className="lp-cta">
            Open dashboard <span className="lp-cta__arrow">→</span>
          </Link>
        ) : (
          <ClaimName rootDomain={rootDomain} signedIn={signedIn} />
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground">
            See it build a site ↓
          </a>
          <a href="#connect" className="hover:text-foreground">
            Already in Claude or ChatGPT? Connect directly ↓
          </a>
        </div>
      </div>
    </section>
  );
}
